import { Router, Request, Response } from 'express';
import { FsAdapter } from '../../hcmService/fs/fsAdapter';
import type { HcmRequest, HcmResponse } from '../../hcmService/types';
import { calculateHash } from '../../hcmService/utils/hashing';

type EnterpriseDeps = {
  fsAdapter: FsAdapter;
  hcmService: { handle: (request: HcmRequest) => Promise<HcmResponse> };
};

type SpaceMeta = {
  space_id: string;
  space_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

type WorkspaceMeta = {
  space_id: string;
  workspace_id: string;
  workspace_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

type DocCore = {
  title: string;
  doc_type?: string;
  tags?: string[];
  body?: string;
  json?: unknown;
  links?: { label?: string; url: string }[];
};

type DocVersion = {
  schema_version: '1.0';
  space_id: string;
  workspace_id: string;
  doc_id: string;
  doc: DocCore;
  meta: {
    version_hash: string;
    created_at: string;
    created_by: { type: 'agent' | 'human' | 'system'; id: string };
    supersedes?: string | null;
  };
};

type DocSummary = {
  doc_id: string;
  title: string;
  doc_type?: string;
  tags?: string[];
  version_hash: string;
  created_at: string;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PREFIX = 'sha256:';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(raw: unknown, label: string): string {
  const id = String(raw ?? '').trim();
  if (!id) throw new Error(`${label} required`);
  if (!SAFE_ID.test(id)) throw new Error(`${label} must be a safe slug (a-zA-Z0-9._-)`);
  return id;
}

function normalizeName(raw: unknown, label: string): string {
  const name = String(raw ?? '').trim();
  if (!name) throw new Error(`${label} required`);
  if (name.length > 256) throw new Error(`${label} too long`);
  return name;
}

function normalizeOptionalText(raw: unknown): string | undefined {
  const value = String(raw ?? '').trim();
  return value ? value : undefined;
}

function stripSha256Prefix(value: string): string {
  const v = String(value || '').trim();
  return v.startsWith(SHA256_PREFIX) ? v.slice(SHA256_PREFIX.length) : v;
}

function formatSha256(hex: string): string {
  const h = String(hex || '').trim();
  return h.startsWith(SHA256_PREFIX) ? h : `${SHA256_PREFIX}${h}`;
}

function uniqueSortedStrings(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned = raw
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0);
  if (cleaned.length === 0) return [];
  const unique = Array.from(new Set(cleaned));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

function normalizeDocCore(raw: unknown): DocCore {
  if (!isPlainObject(raw)) throw new Error('doc must be an object');

  const title = normalizeName(raw.title, 'doc.title');
  const docType = normalizeOptionalText(raw.doc_type ?? raw.type);
  const tags = uniqueSortedStrings(raw.tags);
  const body = normalizeOptionalText(raw.body ?? raw.text ?? raw.markdown);
  const json = Object.prototype.hasOwnProperty.call(raw, 'json') ? (raw as any).json : undefined;

  let links: DocCore['links'] | undefined;
  if (Array.isArray(raw.links)) {
    const parsed = raw.links
      .map((v): { url: string; label?: string } | null => {
        if (!isPlainObject(v)) return null;
        const url = String(v.url ?? '').trim();
        if (!url) return null;
        const label = normalizeOptionalText(v.label);
        return label ? { url, label } : { url };
      })
      .filter((v): v is { url: string; label?: string } => v !== null);
    links = parsed.length > 0 ? parsed : undefined;
  }

  const out: DocCore = { title };
  if (docType) out.doc_type = docType;
  if (tags) out.tags = tags;
  if (body) out.body = body;
  if (json !== undefined) out.json = json;
  if (links) out.links = links;
  return out;
}

function getSpaceMetaPath(spaceId: string) {
  return `domain/spaces/${spaceId}/meta.json`;
}

function getWorkspaceMetaPath(spaceId: string, workspaceId: string) {
  return `domain/spaces/${spaceId}/workspaces/${workspaceId}/meta.json`;
}

function getWorkspaceStateBase(spaceId: string, workspaceId: string) {
  return `state/spaces/${spaceId}/workspaces/${workspaceId}`;
}

function getDocBase(spaceId: string, workspaceId: string, docId: string) {
  const base = `domain/spaces/${spaceId}/workspaces/${workspaceId}/docs/${docId}`;
  return {
    base,
    latest: `${base}/latest.json`,
    versionsDir: `${base}/versions`,
  };
}

async function readIfExists<T>(fsAdapter: FsAdapter, path: string): Promise<T | null> {
  if (!(await fsAdapter.exists(path))) return null;
  try {
    return await fsAdapter.readJson<T>(path);
  } catch {
    return null;
  }
}

export function createEnterpriseRouter(deps: EnterpriseDeps): Router {
  const { fsAdapter, hcmService } = deps;
  const router = Router();

  // ---- Spaces ----
  router.get('/spaces', async (_req: Request, res: Response) => {
    try {
      const files = await fsAdapter.listFilesRecursive('domain/spaces');
      const metaFiles = files.filter((p) => /^domain\/spaces\/[^/]+\/meta\.json$/.test(p));
      const spaces: SpaceMeta[] = [];

      for (const filePath of metaFiles) {
        const meta = await readIfExists<SpaceMeta>(fsAdapter, filePath);
        if (meta && meta.space_id && meta.space_name) spaces.push(meta);
      }

      spaces.sort((a, b) => a.space_name.localeCompare(b.space_name));
      return res.status(200).json({ spaces });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
    }
  });

  router.post('/spaces', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const spaceId = normalizeId(body.space_id ?? body.spaceId ?? body.id, 'space_id');
      const spaceName = normalizeName(body.space_name ?? body.spaceName ?? body.name, 'space_name');
      const description = normalizeOptionalText(body.description);

      const metaPath = getSpaceMetaPath(spaceId);
      const now = new Date().toISOString();

      const existing = await readIfExists<SpaceMeta>(fsAdapter, metaPath);
      if (existing) return res.status(200).json(existing);

      const meta: SpaceMeta = {
        space_id: spaceId,
        space_name: spaceName,
        description,
        created_at: now,
        updated_at: now,
      };

      await fsAdapter.writeJsonAtomic(metaPath, meta);
      await fsAdapter.ensureDir(`domain/spaces/${spaceId}/workspaces`);
      return res.status(201).json(meta);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: err.message || String(err) });
    }
  });

  router.get('/spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const metaPath = getSpaceMetaPath(spaceId);
      const meta = await readIfExists<SpaceMeta>(fsAdapter, metaPath);
      if (!meta) return res.status(404).json({ error: 'NOT_FOUND', message: `Space ${spaceId} not found` });
      return res.status(200).json(meta);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: err.message || String(err) });
    }
  });

  // ---- Workspaces ----
  router.get('/spaces/:spaceId/workspaces', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const spaceMeta = await readIfExists<SpaceMeta>(fsAdapter, getSpaceMetaPath(spaceId));
      if (!spaceMeta) return res.status(404).json({ error: 'NOT_FOUND', message: `Space ${spaceId} not found` });

      const files = await fsAdapter.listFilesRecursive(`domain/spaces/${spaceId}/workspaces`);
      const metaFiles = files.filter((p) => new RegExp(`^domain/spaces/${spaceId}/workspaces/[^/]+/meta\\.json$`).test(p));
      const workspaces: WorkspaceMeta[] = [];
      for (const filePath of metaFiles) {
        const meta = await readIfExists<WorkspaceMeta>(fsAdapter, filePath);
        if (meta && meta.workspace_id && meta.workspace_name) workspaces.push(meta);
      }
      workspaces.sort((a, b) => a.workspace_name.localeCompare(b.workspace_name));
      return res.status(200).json({ workspaces });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
    }
  });

  router.post('/spaces/:spaceId/workspaces', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const spaceMeta = await readIfExists<SpaceMeta>(fsAdapter, getSpaceMetaPath(spaceId));
      if (!spaceMeta) return res.status(404).json({ error: 'NOT_FOUND', message: `Space ${spaceId} not found` });

      const body = req.body || {};
      const workspaceId = normalizeId(body.workspace_id ?? body.workspaceId ?? body.id, 'workspace_id');
      const workspaceName = normalizeName(body.workspace_name ?? body.workspaceName ?? body.name, 'workspace_name');
      const description = normalizeOptionalText(body.description);

      const metaPath = getWorkspaceMetaPath(spaceId, workspaceId);
      const now = new Date().toISOString();
      const existing = await readIfExists<WorkspaceMeta>(fsAdapter, metaPath);
      if (existing) return res.status(200).json(existing);

      const meta: WorkspaceMeta = {
        space_id: spaceId,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        description,
        created_at: now,
        updated_at: now,
      };

      await fsAdapter.writeJsonAtomic(metaPath, meta);

      // Minimal runtime scaffold (state/)
      const stateBase = getWorkspaceStateBase(spaceId, workspaceId);
      await fsAdapter.ensureDir(stateBase);
      const statusPath = `${stateBase}/status.json`;
      if (!(await fsAdapter.exists(statusPath))) {
        await fsAdapter.writeJsonAtomic(statusPath, { status: 'active', created_at: now, updated_at: now });
      }
      const journalPath = `${stateBase}/journal.jsonl`;
      if (!(await fsAdapter.exists(journalPath))) {
        await fsAdapter.appendJsonLine(journalPath, { timestamp: now, entry_type: 'info', message: 'Workspace created' });
      }

      return res.status(201).json(meta);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: err.message || String(err) });
    }
  });

  router.get('/spaces/:spaceId/workspaces/:workspaceId', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const workspaceId = normalizeId(req.params.workspaceId, 'workspaceId');
      const metaPath = getWorkspaceMetaPath(spaceId, workspaceId);
      const meta = await readIfExists<WorkspaceMeta>(fsAdapter, metaPath);
      if (!meta) return res.status(404).json({ error: 'NOT_FOUND', message: `Workspace ${workspaceId} not found` });
      return res.status(200).json(meta);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: err.message || String(err) });
    }
  });

  // ---- Docs (versioned) ----
  router.get('/spaces/:spaceId/workspaces/:workspaceId/docs', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const workspaceId = normalizeId(req.params.workspaceId, 'workspaceId');
      const base = `domain/spaces/${spaceId}/workspaces/${workspaceId}/docs`;
      const files = await fsAdapter.listFilesRecursive(base);
      const latestFiles = files.filter((p) =>
        new RegExp(`^domain/spaces/${spaceId}/workspaces/${workspaceId}/docs/[^/]+/latest\\.json$`).test(p),
      );

      const docs: DocSummary[] = [];
      for (const filePath of latestFiles) {
        const doc = await readIfExists<DocVersion>(fsAdapter, filePath);
        if (!doc?.doc_id || !doc?.doc?.title || !doc?.meta?.version_hash || !doc?.meta?.created_at) continue;
        docs.push({
          doc_id: doc.doc_id,
          title: doc.doc.title,
          doc_type: doc.doc.doc_type,
          tags: doc.doc.tags,
          version_hash: doc.meta.version_hash,
          created_at: doc.meta.created_at,
        });
      }
      docs.sort((a, b) => a.title.localeCompare(b.title));
      return res.status(200).json({ docs });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
    }
  });

  router.post('/spaces/:spaceId/workspaces/:workspaceId/docs', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const workspaceId = normalizeId(req.params.workspaceId, 'workspaceId');

      const workspaceMeta = await readIfExists<WorkspaceMeta>(fsAdapter, getWorkspaceMetaPath(spaceId, workspaceId));
      if (!workspaceMeta) return res.status(404).json({ error: 'NOT_FOUND', message: `Workspace ${workspaceId} not found` });

      const body = req.body || {};
      const docId = normalizeId(body.doc_id ?? body.docId ?? body.id ?? `doc_${Date.now()}`, 'doc_id');

      const docCore = normalizeDocCore(isPlainObject(body.doc) ? body.doc : body);
      const expectedRaw = (body as any).expected_base_hash;
      const expectedBaseHash =
        expectedRaw === undefined ? undefined : expectedRaw === null ? null : String(expectedRaw || '').trim();

      const paths = getDocBase(spaceId, workspaceId, docId);
      const latest = await readIfExists<DocVersion>(fsAdapter, paths.latest);
      const currentHex = latest?.meta?.version_hash ? stripSha256Prefix(String(latest.meta.version_hash)) : null;

      if (expectedBaseHash !== undefined) {
        const expectedHex = expectedBaseHash === null ? null : stripSha256Prefix(expectedBaseHash);
        if (expectedHex !== currentHex) {
          return res.status(409).json({
            error: 'CONFLICTING_UPDATE',
            message: 'doc version conflict',
            details: {
              expected_base_hash: expectedHex ? formatSha256(expectedHex) : null,
              current_hash: currentHex ? formatSha256(currentHex) : null,
            },
          });
        }
      }

      const contentHashHex = calculateHash({ space_id: spaceId, workspace_id: workspaceId, doc_id: docId, doc: docCore });
      const versionHash = formatSha256(contentHashHex);
      const versionPath = `${paths.versionsDir}/${contentHashHex}.json`;

      if (await fsAdapter.exists(versionPath)) {
        const existing = await fsAdapter.readJson<DocVersion>(versionPath);
        await fsAdapter.writeJsonAtomic(paths.latest, existing);
        return res.status(200).json(existing);
      }

      const now = new Date().toISOString();
      const doc: DocVersion = {
        schema_version: '1.0',
        space_id: spaceId,
        workspace_id: workspaceId,
        doc_id: docId,
        doc: docCore,
        meta: {
          version_hash: versionHash,
          created_at: now,
          created_by: { type: 'system', id: 'enterprise-api' },
          supersedes: latest?.meta?.version_hash ?? null,
        },
      };

      await fsAdapter.writeJsonAtomic(versionPath, doc);
      await fsAdapter.writeJsonAtomic(paths.latest, doc);

      return res.status(201).json(doc);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: err.message || String(err) });
    }
  });

  router.get('/spaces/:spaceId/workspaces/:workspaceId/docs/:docId/latest', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const workspaceId = normalizeId(req.params.workspaceId, 'workspaceId');
      const docId = normalizeId(req.params.docId, 'docId');

      const paths = getDocBase(spaceId, workspaceId, docId);
      const doc = await readIfExists<DocVersion>(fsAdapter, paths.latest);
      if (!doc) return res.status(404).json({ error: 'NOT_FOUND', message: `Doc ${docId} not found` });
      return res.status(200).json(doc);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: err.message || String(err) });
    }
  });

  router.get('/spaces/:spaceId/workspaces/:workspaceId/docs/:docId/versions/:version', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const workspaceId = normalizeId(req.params.workspaceId, 'workspaceId');
      const docId = normalizeId(req.params.docId, 'docId');
      const version = normalizeId(req.params.version, 'version');

      const hex = stripSha256Prefix(version);
      const paths = getDocBase(spaceId, workspaceId, docId);
      const versionPath = `${paths.versionsDir}/${hex}.json`;
      const doc = await readIfExists<DocVersion>(fsAdapter, versionPath);
      if (!doc) return res.status(404).json({ error: 'NOT_FOUND', message: `Doc ${docId}@${version} not found` });
      return res.status(200).json(doc);
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: err.message || String(err) });
    }
  });

  // ---- Search (scoped) ----
  router.post('/spaces/:spaceId/search', async (req: Request, res: Response) => {
    try {
      const spaceId = normalizeId(req.params.spaceId, 'spaceId');
      const body = req.body || {};
      const query = String(body.query ?? '').trim();
      if (!query) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'query required' });

      const workspaceIdRaw = body.workspace_id ?? body.workspaceId ?? null;
      const workspaceId = workspaceIdRaw ? normalizeId(workspaceIdRaw, 'workspace_id') : null;

      const request: HcmRequest = {
        op: 'HCM_SEARCH',
        request_id: `ent_${Date.now()}`,
        caller: { type: 'human', id: 'enterprise-api', roles: ['human'] },
        payload: { query },
      };

      const out = await hcmService.handle(request);
      if (out.status !== 'ok') {
        return res.status(500).json({ error: out.error?.code || 'INTERNAL_ERROR', message: out.error?.message || 'HCM error' });
      }

      const data = out.data as any;
      const results = Array.isArray(data?.results) ? data.results : [];
      const filtered = results.filter((r: any) => {
        const source = String(r?.source ?? '');
        if (!source) return false;
        if (source.startsWith('stable/')) return true;
        if (workspaceId) {
          return (
            source.startsWith(`domain/spaces/${spaceId}/workspaces/${workspaceId}/`) ||
            source.startsWith(`state/spaces/${spaceId}/workspaces/${workspaceId}/`)
          );
        }
        return (
          source.startsWith(`domain/spaces/${spaceId}/`) ||
          source.startsWith(`state/spaces/${spaceId}/`)
        );
      });

      const next = { ...(data || {}), count: filtered.length, results: filtered };
      return res.status(200).json({ ok: true, data: next, error: null, meta: { request_id: request.request_id, op: request.op, hcm_version: '1.1' } });
    } catch (err: any) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: err.message || String(err) });
    }
  });

  return router;
}
