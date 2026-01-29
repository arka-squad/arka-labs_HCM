import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import Ajv2020, { ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { HcmService } from './hcmService';
import { HcmController } from './api/controllers/HcmController';
import { FsAdapter } from './hcmService/fs/fsAdapter';
import { ContractEngine } from './hcmService/contracts/ContractEngine';
import { PackEngine } from './hcmService/packs/PackEngine';
import { ArtifactEngine } from './hcmService/artifacts/ArtifactEngine';
import { scaffoldMission } from './hcmService/ops/missionScaffold';
import { listMissions } from './hcmService/ops/listMissions';
import { appendJournal } from './hcmService/ops/appendJournal';
import { calculateHash } from './hcmService/utils/hashing';
import { createEnterpriseRouter } from './api/routes/enterprise';

const app: Express = express();
const port = Number(process.env.PORT || 9096);

const corsOriginRaw = String(process.env.CORS_ORIGIN || 'http://localhost:5173').trim();
const corsOrigin =
  corsOriginRaw === '*'
    ? '*'
    : corsOriginRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

// Middleware
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// ---- Schema validation (v1) ----
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

const formatAjvErrors = (errors: any) =>
  (errors || []).map((e: any) => `${e.instancePath || '/'} ${e.message || ''}`.trim());

const readSchemaFile = (filename: string): any => {
  const schemaPath = path.join(process.cwd(), 'schemas', filename);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema_file_missing:${filename}`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
};

const validateProjectContext: ValidateFunction = ajv.compile(readSchemaFile('project_context.v1.schema.json'));

const SHA256_PREFIX = 'sha256:';
const stripSha256Prefix = (value: string) => (value.startsWith(SHA256_PREFIX) ? value.slice(SHA256_PREFIX.length) : value);
const formatSha256 = (hex: string) => (hex.startsWith(SHA256_PREFIX) ? hex : `${SHA256_PREFIX}${hex}`);

const hasOwn = (obj: unknown, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

const DEFAULT_MISSION_STATUS = { phase: 'init', status: 'planned', health: 'ok' };

async function readMissionStatus(missionId: string) {
  const statusPath = `state/missions/${missionId}/status.json`;
  const status = await fsAdapter.readJson<any>(statusPath).catch(() => ({}));
  return { ...DEFAULT_MISSION_STATUS, ...(status || {}) };
}

// HCM Setup
// Determine root path: ENV variable or default to relative 'hcm' folder
// Assuming 'hcm' folder is at the project root (../hcm from src)
const hcmRoot = process.env.HCM_ROOT || path.join(process.cwd(), 'hcm');

const hcmService = new HcmService(hcmRoot);
const hcmController = new HcmController(hcmService);
const fsAdapter = new FsAdapter(hcmRoot);
const contractEngine = new ContractEngine(fsAdapter);
const packEngine = new PackEngine(fsAdapter);
const artifactEngine = new ArtifactEngine(fsAdapter);

// Enterprise-first routes (spaces/workspaces/docs)
app.use('/v1', createEnterpriseRouter({ fsAdapter, hcmService }));

// Routes
app.post('/v1/hcm/missions', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const missionId = body.mission_id || body.missionId;
    if (!missionId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'mission_id required' });
    }

    const metaPath = `state/missions/${missionId}/meta.json`;
    const exists = await fsAdapter.exists(metaPath);
    if (!exists) {
      const { initial_contract, ...meta } = body;
      await scaffoldMission(fsAdapter, missionId, meta);
    }

    // Optional initial contract in create payload (hub mission:create)
    if (body.initial_contract) {
      const latest = await contractEngine.getLatest(missionId);
      const expectedBaseHash = latest ? calculateHash(latest) : null;
      const out = await contractEngine.createVersion(missionId, body.initial_contract, expectedBaseHash);
      const meta = (await fsAdapter.readJson<any>(metaPath)) || { mission_id: missionId };
      meta.contract_ref = {
        contract_id:
          body.initial_contract.contract_id ||
          body.initial_contract.id ||
          body.initial_contract.contract_meta?.contract_id ||
          body.initial_contract.contract_meta?.id ||
          null,
        contract_version: formatSha256(out.hash),
      };
      await fsAdapter.writeJson(metaPath, meta);
      return res.status(200).json({ mission_id: missionId, contract_ref: meta.contract_ref });
    }

    const meta = await fsAdapter.readJson<any>(metaPath);
    return res.status(200).json(meta);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/missions', async (req: Request, res: Response) => {
  try {
    const missions = await listMissions(fsAdapter, { business_id: typeof req.query.business_id === 'string' ? req.query.business_id : undefined });
    res.status(200).json({ missions });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/missions/:missionId', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId;
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      return res.status(404).json({ error: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` });
    }
    const meta = await fsAdapter.readJson<any>(metaPath);
    return res.status(200).json(meta);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/missions/:missionId/status', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId;
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      return res.status(404).json({ error: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` });
    }
    const status = await readMissionStatus(missionId);
    return res.status(200).json(status);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.patch('/v1/hcm/missions/:missionId/status', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId;
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      return res.status(404).json({ error: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` });
    }

    const body = req.body || {};
    const action = String(body.action || '').trim().toUpperCase();
    if (action !== 'ARCHIVE' && action !== 'CLOSE') {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'action must be ARCHIVE or CLOSE' });
    }

    const actor = body.actor && typeof body.actor === 'object' ? body.actor : null;
    const actorType =
      actor?.type === 'agent' || actor?.type === 'human' || actor?.type === 'system' ? actor.type : 'system';
    const actorId =
      typeof actor?.id === 'string' && actor.id.trim() ? actor.id.trim() : 'mission-status';
    const now = new Date().toISOString();

    const statusPath = `state/missions/${missionId}/status.json`;
    const current = await readMissionStatus(missionId);
    const lifecycle = current.lifecycle && typeof current.lifecycle === 'object' && !Array.isArray(current.lifecycle)
      ? { ...current.lifecycle }
      : {};

    if (action === 'ARCHIVE') {
      lifecycle.state = 'ARCHIVED';
      lifecycle.archived_at = now;
      lifecycle.archived_by = { id: actorId, type: actorType };
    }
    if (action === 'CLOSE') {
      lifecycle.state = 'CLOSED';
      lifecycle.closed_at = now;
      lifecycle.closed_by = { id: actorId, type: actorType };
    }

    const nextStatus = { ...current, lifecycle, updated_at: now };
    await fsAdapter.writeJson(statusPath, nextStatus);

    try {
      await appendJournal(fsAdapter, missionId, {
        author_type: actorType,
        author_id: actorId,
        entry_type: 'event',
        message: action === 'ARCHIVE' ? 'Mission archived' : 'Mission closed',
        context: { action, lifecycle },
      });
    } catch {
      // best effort
    }

    return res.status(200).json(nextStatus);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.post('/v1/hcm/contracts', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const body = req.body || {};
    const contract = body.contract && typeof body.contract === 'object' ? body.contract : body;
    const expectedBaseHashRaw = hasOwn(body, 'expected_base_hash')
      ? (body as any).expected_base_hash
      : hasOwn(body, 'expectedBaseHash')
        ? (body as any).expectedBaseHash
        : undefined;

    if (expectedBaseHashRaw !== undefined && (typeof expectedBaseHashRaw !== 'string' || !expectedBaseHashRaw.trim())) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: { code: 'INVALID_PAYLOAD', message: 'expected_base_hash must be a non-empty string' },
        meta: { duration_ms: Date.now() - start, hcm_version: '1.1' },
      });
    }
    const expectedBaseHash =
      expectedBaseHashRaw === undefined ? undefined : stripSha256Prefix(String(expectedBaseHashRaw).trim());

    const missionId = contract.mission_id || contract.contract_meta?.mission_id;
    const contractId = contract.contract_id || contract.id || contract.contract_meta?.contract_id || contract.contract_meta?.id;
    if (!missionId || !contractId) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: { code: 'INVALID_PAYLOAD', message: 'mission_id and contract_id required' },
        meta: { duration_ms: Date.now() - start, hcm_version: '1.1' },
      });
    }

    // Ensure mission scaffold exists
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      await scaffoldMission(fsAdapter, missionId, {});
    }

    const latest = await contractEngine.getLatest(missionId);
    const currentHash = latest ? calculateHash(latest) : null;
    const baseHash = expectedBaseHashRaw !== undefined ? (expectedBaseHash ?? null) : currentHash;
    const out = await contractEngine.createVersion(missionId, contract, baseHash);

    // Update mission meta with contract_ref for hub lookups
    const meta = (await fsAdapter.readJson<any>(metaPath)) || { mission_id: missionId };
    meta.contract_ref = { contract_id: contractId, contract_version: formatSha256(out.hash) };
    await fsAdapter.writeJson(metaPath, meta);

    return res.status(200).json({
      ok: true,
      data: { contract_ref: meta.contract_ref, contract: out.contract },
      error: null,
      meta: { duration_ms: Date.now() - start, hcm_version: '1.1' },
    });
  } catch (err: any) {
    if (err?.code === 'CONFLICTING_UPDATE') {
      return res.status(409).json({
        ok: false,
        data: null,
        error: { code: 'CONTRACT_CONFLICT', message: err.message || 'Contract conflict', details: err.details },
        meta: { duration_ms: Date.now() - start, hcm_version: '1.1' },
      });
    }
    return res.status(500).json({
      ok: false,
      data: null,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || String(err) },
      meta: { duration_ms: Date.now() - start, hcm_version: '1.1' },
    });
  }
});

app.post('/v1/hcm/packs', async (req: Request, res: Response) => {
  try {
    const pack = req.body || {};
    const missionId = pack.mission_id || pack.missionId || pack.pack_meta?.mission_id;
    if (!missionId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'mission_id required' });
    }

    const packId = pack.pack_id || pack.packId || pack.pack_meta?.pack_id || pack.pack_meta?.packId;
    const packType =
      pack.pack_type ||
      pack.packType ||
      pack.pack_meta?.pack_type ||
      pack.pack_meta?.packType ||
      pack.pack_meta?.type;
    const payload = pack.payload ?? pack.pack_payload ?? pack.packPayload;

    const normalizedPack = {
      ...pack,
      mission_id: missionId,
      pack_id: packId,
      payload,
      pack_meta: {
        ...(pack.pack_meta || {}),
        mission_id: missionId,
        pack_id: packId,
        ...(packType ? { pack_type: packType } : {}),
      },
    };

    // Ensure mission scaffold exists
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      await scaffoldMission(fsAdapter, missionId, {});
    }

    const out = await packEngine.storePack(missionId, normalizedPack);
    const storageRef =
      normalizedPack.pack_meta?.storage_ref ||
      normalizedPack.pack_meta?.pack_ref ||
      pack.storage_ref ||
      pack.pack_ref ||
      `hcm://${missionId}/packs/${out.pack_id}`;
    return res.status(200).json({ pack_id: out.pack_id, hash: formatSha256(out.hash), storage_ref: storageRef, pack_ref: storageRef });
  } catch (err: any) {
    if (err?.code === 'CONFLICTING_UPDATE') {
      return res.status(409).json({ error: err.code, message: err.message, details: err.details });
    }
    if (err?.code === 'INVALID_PAYLOAD') {
      return res.status(400).json({ error: err.code, message: err.message, details: err.details });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/packs/:packId', async (req: Request, res: Response) => {
  try {
    const packId = req.params.packId;
    if (!packId) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'packId required' });
    }

    const missionId =
      (typeof req.query.mission_id === 'string' ? req.query.mission_id : null) ||
      (typeof req.query.missionId === 'string' ? req.query.missionId : null);

    if (missionId) {
      const pack = await packEngine.getPack(missionId, packId);
      if (!pack) return res.status(404).json({ error: 'PACK_NOT_FOUND', message: `Pack ${packId} not found` });
      return res.status(200).json(pack);
    }

    const missions = await listMissions(fsAdapter);
    for (const mId of missions) {
      const pack = await packEngine.getPack(mId, packId);
      if (pack) return res.status(200).json(pack);
    }

    return res.status(404).json({ error: 'PACK_NOT_FOUND', message: `Pack ${packId} not found` });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.post('/v1/hcm/artifacts', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const requestedArtifactId =
      typeof body.artifact_id === 'string'
        ? body.artifact_id
        : typeof body.artifactId === 'string'
          ? body.artifactId
          : null;
    const missionId =
      body.mission_id ||
      body.missionId ||
      (body.meta && typeof body.meta === 'object' ? body.meta.mission_id || body.meta.missionId : null);
    if (!missionId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'mission_id required' });
    }

    const mediaType = body.media_type || body.mediaType || body.mime_type || body.mimeType || body.mimetype || 'application/octet-stream';
    const classification = body.classification || undefined;
    const createdBy = body.created_by || body.createdBy || undefined;

    const contentB64 = body.content_b64 || body.content_base64 || body.contentB64 || undefined;
    const rawContent = body.content ?? body.data ?? null;
    if (contentB64 === undefined && (rawContent === null || rawContent === undefined || rawContent === '')) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'content (or content_b64) required' });
    }

    const encoding = contentB64 !== undefined ? 'base64' : undefined;
    const content =
      contentB64 !== undefined ? String(contentB64) : typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

    // Ensure mission scaffold exists
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
      await scaffoldMission(fsAdapter, missionId, {});
    }

    const metaFromBody = body.meta && typeof body.meta === 'object' ? body.meta : {};
    const artifactMeta = {
      ...metaFromBody,
      media_type: mediaType,
      ...(classification ? { classification } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
      ...(encoding ? { encoding } : {}),
      ...(body.filename ? { filename: body.filename } : {}),
    };

    const out = await artifactEngine.putArtifact(String(missionId), content, artifactMeta, { artifact_id: requestedArtifactId });
    const storageRef = `hcm://artifacts/${out.artifact_id}`;

    return res.status(200).json({
      artifact_id: out.artifact_id,
      blob_hash: out.blob_hash,
      integrity: { hash_algo: 'sha256', hash: formatSha256(out.blob_hash) },
      storage_ref: storageRef,
      artifact_ref: storageRef,
      mission_id: String(missionId),
    });
  } catch (err: any) {
    if (err?.code === 'CONFLICTING_UPDATE') {
      return res.status(409).json({ error: 'CONFLICTING_UPDATE', message: 'Artifact exists with different content', details: err.details || null });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/artifacts/:artifactId', async (req: Request, res: Response) => {
  try {
    const artifactId = req.params.artifactId;
    if (!artifactId) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'artifactId required' });
    }

    const missionId =
      (typeof req.query.mission_id === 'string' ? req.query.mission_id : null) ||
      (typeof req.query.missionId === 'string' ? req.query.missionId : null);

    const loadArtifact = async (mId: string) => {
      const metaPath = `state/missions/${mId}/artifacts/meta/${artifactId}.json`;
      if (!(await fsAdapter.exists(metaPath))) return null;
      const out = await artifactEngine.getArtifact(mId, artifactId);
      return out ? { mission_id: mId, ...out } : null;
    };

    let artifact: any | null = null;
    if (missionId) {
      artifact = await loadArtifact(missionId);
    } else {
      const missions = await listMissions(fsAdapter);
      for (const mId of missions) {
        artifact = await loadArtifact(mId);
        if (artifact) break;
      }
    }

    if (!artifact) {
      return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND', message: `Artifact ${artifactId} not found` });
    }

    const blobHash = artifact?.meta?.blob_hash ? String(artifact.meta.blob_hash) : null;
    const storageRef = `hcm://artifacts/${artifactId}`;

    return res.status(200).json({
      artifact_id: artifactId,
      mission_id: artifact.mission_id,
      storage_ref: storageRef,
      integrity: blobHash ? { hash_algo: 'sha256', hash: formatSha256(blobHash) } : null,
      meta: artifact.meta,
      content: artifact.content,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

// --- ProjectContext (v1) ---
// Storage layout:
// - domain/projects/<project_id>/context/latest.json
// - domain/projects/<project_id>/context/versions/<hash>.json
app.get('/v1/hcm/projects/:projectId/context/latest', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'projectId required' });

    const latestPath = `domain/projects/${projectId}/context/latest.json`;
    if (!(await fsAdapter.exists(latestPath))) {
      return res.status(404).json({ error: 'PROJECT_CONTEXT_NOT_FOUND', message: `ProjectContext not found for ${projectId}` });
    }
    const doc = await fsAdapter.readJson<any>(latestPath);
    return res.status(200).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/projects/:projectId/context/versions/:version', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId || '').trim();
    const versionRaw = String(req.params.version || '').trim();
    if (!projectId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'projectId required' });
    if (!versionRaw) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'version required' });

    const version = stripSha256Prefix(versionRaw);
    const versionPath = `domain/projects/${projectId}/context/versions/${version}.json`;
    if (!(await fsAdapter.exists(versionPath))) {
      return res.status(404).json({ error: 'PROJECT_CONTEXT_NOT_FOUND', message: `ProjectContext version not found: ${versionRaw}` });
    }
    const doc = await fsAdapter.readJson<any>(versionPath);
    return res.status(200).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.post('/v1/hcm/projects/:projectId/context/versions', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'projectId required' });

    const doc: any = req.body || {};
    if (typeof doc !== 'object' || Array.isArray(doc) || !doc) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'ProjectContext JSON object required' });
    }
    if (doc.schema !== 'arka.project_context.v1') {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'schema must be arka.project_context.v1' });
    }
    const docProjectId = String(doc?.project_meta?.project_id || '').trim();
    if (!docProjectId || docProjectId !== projectId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'project_meta.project_id must match URL' });
    }

    const valid = validateProjectContext(doc);
    if (!valid) {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'ProjectContext schema invalid',
        details: { errors: formatAjvErrors(validateProjectContext.errors) },
      });
    }

    const contentHex = calculateHash(doc);
    const contentHash = formatSha256(contentHex);
    const versionPath = `domain/projects/${projectId}/context/versions/${contentHex}.json`;
    const latestPath = `domain/projects/${projectId}/context/latest.json`;

    // Idempotent store: if same version exists, return ok; otherwise write.
    if (!(await fsAdapter.exists(versionPath))) {
      await fsAdapter.writeJson(versionPath, doc);
    } else {
      const existing = await fsAdapter.readJson<any>(versionPath);
      const existingHex = calculateHash(existing);
      if (existingHex !== contentHex) {
        return res.status(409).json({ error: 'CONFLICTING_UPDATE', message: 'Version hash collision', details: { content_hash: contentHash } });
      }
    }

    await fsAdapter.writeJson(latestPath, doc);

    return res.status(200).json({
      project_id: projectId,
      project_context_ref: {
        project_id: projectId,
        document_version: String((doc as any)?.project_meta?.document_version || 'unknown'),
        content_hash: contentHash,
      },
      stored_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

// --- Atoms registry (v1, stable) ---
// Storage layout:
// - stable/atoms/<atom_id>/latest.json
// - stable/atoms/<atom_id>/versions/<atom_version>.json
const normalizeStableSegment = (raw: unknown): string | null => {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  if (s.includes('..') || s.includes('/') || s.includes('\\')) return null;
  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(s)) return null;
  return s;
};

app.get('/v1/hcm/atoms/:atomId/latest', async (req: Request, res: Response) => {
  try {
    const atomId = normalizeStableSegment(req.params.atomId);
    if (!atomId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'atomId invalid' });

    const latestPath = `stable/atoms/${atomId}/latest.json`;
    if (!(await fsAdapter.exists(latestPath))) {
      return res.status(404).json({ error: 'ATOM_NOT_FOUND', message: `Atom ${atomId} not found` });
    }
    const doc = await fsAdapter.readJson<any>(latestPath);
    return res.status(200).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/atoms/:atomId/versions/:version', async (req: Request, res: Response) => {
  try {
    const atomId = normalizeStableSegment(req.params.atomId);
    const version = normalizeStableSegment(req.params.version);
    if (!atomId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'atomId invalid' });
    if (!version) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'version invalid' });

    const versionPath = `stable/atoms/${atomId}/versions/${version}.json`;
    if (!(await fsAdapter.exists(versionPath))) {
      return res.status(404).json({ error: 'ATOM_NOT_FOUND', message: `Atom ${atomId}@${version} not found` });
    }
    const doc = await fsAdapter.readJson<any>(versionPath);
    return res.status(200).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

async function findContractVersion(contractId: string, version: string) {
  const normalizedVersion = stripSha256Prefix(String(version || '').trim());
  if (!normalizedVersion) return null;
  const missions = await listMissions(fsAdapter);
  for (const mId of missions) {
    const p = `state/missions/${mId}/contracts/versions/${normalizedVersion}.json`;
    if (await fsAdapter.exists(p)) {
      const c = await fsAdapter.readJson<any>(p);
      if (
        !contractId ||
        c.contract_id === contractId ||
        c.id === contractId ||
        c.contract_meta?.contract_id === contractId ||
        c.contract_meta?.id === contractId
      )
        return c;
    }
  }
  return null;
}

async function findContractBySemanticVersion(contractId: string, contractVersion: number) {
  if (!contractId || !Number.isFinite(contractVersion) || contractVersion < 1) return null;
  const missions = await listMissions(fsAdapter);
  for (const mId of missions) {
    const files = await fsAdapter.listFilesRecursive(`state/missions/${mId}/contracts/versions`);
    for (const f of files) {
      if (!String(f || '').endsWith('.json')) continue;
      try {
        const c = await fsAdapter.readJson<any>(f);
        const cid = c.contract_id || c.id || c.contract_meta?.contract_id || c.contract_meta?.id || null;
        const cv = Number(c.contract_meta?.contract_version || c.contract_version || 0);
        if (cid === contractId && cv === contractVersion) return c;
      } catch {
        // best effort: ignore unreadable files
      }
    }
  }
  return null;
}

async function findContractLatestWithMission(contractId: string) {
  const missions = await listMissions(fsAdapter);
  for (const mId of missions) {
    const p = `state/missions/${mId}/contracts/latest.json`;
    if (await fsAdapter.exists(p)) {
      const c = await fsAdapter.readJson<any>(p);
      if (
        !contractId ||
        c.contract_id === contractId ||
        c.id === contractId ||
        c.contract_meta?.contract_id === contractId ||
        c.contract_meta?.id === contractId
      )
        return { missionId: mId, contract: c };
    }
  }
  return null;
}

async function findContractLatest(contractId: string) {
  const missions = await listMissions(fsAdapter);
  for (const mId of missions) {
    const p = `state/missions/${mId}/contracts/latest.json`;
    if (await fsAdapter.exists(p)) {
      const c = await fsAdapter.readJson<any>(p);
      if (
        !contractId ||
        c.contract_id === contractId ||
        c.id === contractId ||
        c.contract_meta?.contract_id === contractId ||
        c.contract_meta?.id === contractId
      )
        return c;
    }
  }
  return null;
}

function parseMutationPath(p: string): string[] {
  if (!p || typeof p !== 'string') return [];
  const cleaned = p.startsWith('/') ? p.slice(1) : p;
  return cleaned.split('.').filter(Boolean);
}

function ensureArrayAtPath(root: any, segments: string[]): any[] {
  if (!root || typeof root !== 'object') {
    throw { code: 'INVALID_PAYLOAD', message: 'contract must be an object' };
  }
  if (!segments.length) {
    throw { code: 'INVALID_PAYLOAD', message: 'path required' };
  }
  let cursor = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (!seg) continue;

    if (isLast) {
      if (cursor[seg] === undefined) cursor[seg] = [];
      if (!Array.isArray(cursor[seg])) {
        throw { code: 'INVALID_PAYLOAD', message: `path ${segments.join('.')} must be an array` };
      }
      return cursor[seg];
    }

    if (cursor[seg] === undefined) cursor[seg] = {};
    if (cursor[seg] === null || typeof cursor[seg] !== 'object' || Array.isArray(cursor[seg])) {
      throw { code: 'INVALID_PAYLOAD', message: `path ${segments.slice(0, i + 1).join('.')} must be an object` };
    }
    cursor = cursor[seg];
  }
  throw { code: 'INVALID_PAYLOAD', message: 'invalid path' };
}

app.post('/v1/hcm/contracts/:contractId/mutations', async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId;
    const body = req.body || {};
    const operations = Array.isArray((body as any).operations) ? (body as any).operations : null;
    const mutation = (body as any).mutation && typeof (body as any).mutation === 'object' ? (body as any).mutation : null;
    const expectedBaseHashRaw = hasOwn(body, 'expected_base_hash')
      ? (body as any).expected_base_hash
      : hasOwn(body, 'expectedBaseHash')
        ? (body as any).expectedBaseHash
        : undefined;

    if (expectedBaseHashRaw !== undefined && (typeof expectedBaseHashRaw !== 'string' || !expectedBaseHashRaw.trim())) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'expected_base_hash must be a non-empty string' });
    }
    const expectedBaseHash =
      expectedBaseHashRaw === undefined ? undefined : stripSha256Prefix(String(expectedBaseHashRaw).trim());

    if (!operations && !mutation) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'operations (array) or mutation is required' });
    }

    const found = await findContractLatestWithMission(contractId);
    if (!found) {
      return res.status(404).json({ error: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId} not found` });
    }

    const { missionId, contract: currentContract } = found;
    const nextContract = JSON.parse(JSON.stringify(currentContract));
    const currentHash = calculateHash(currentContract);
    let changed = false;

    const currentStatus = await readMissionStatus(missionId);
    const lifecycleState = String(currentStatus?.lifecycle?.state || '').trim().toUpperCase();
    if (lifecycleState === 'CLOSED') {
      return res.status(409).json({
        error: 'MISSION_CLOSED',
        message: 'Mission is closed. Duplicate to continue.',
      });
    }

    if (expectedBaseHashRaw !== undefined && expectedBaseHash !== currentHash) {
      return res.status(409).json({
        error: 'CONTRACT_CONFLICT',
        message: 'expected_base_hash does not match latest contract hash',
        details: { expected_base_hash: formatSha256(String(expectedBaseHash)), current_hash: formatSha256(currentHash) },
      });
    }

    if (operations) {
      for (const op of operations) {
        if (!op || typeof op !== 'object') continue;
        if (op.op === 'ensure_unique') {
          const key = op.key;
          const value = op.value;
          if (!key || value === undefined) {
            return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'ensure_unique requires key and value' });
          }
          const segments = parseMutationPath(op.path);
          const arr = ensureArrayAtPath(nextContract, segments);

          const uniqueValue = value?.[key];
          if (uniqueValue === undefined) {
            return res.status(400).json({ error: 'INVALID_PAYLOAD', message: `ensure_unique value must include key "${key}"` });
          }

          const existing = arr.find((e: any) => e && e[key] === uniqueValue);
          if (existing) {
            if (calculateHash(existing) !== calculateHash(value)) {
              return res.status(409).json({
                error: 'CONFLICTING_UPDATE',
                message: `Conflict: entry with ${key}=${uniqueValue} already exists with different content`,
              });
            }
            continue; // idempotent
          }
          arr.push(value);
          changed = true;
          continue;
        }

        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: `Unsupported mutation op: ${op.op}` });
      }
    }

    if (mutation) {
      const opName = String(mutation.op || mutation.operation || '').toUpperCase();
      const pathStr = mutation.path;
      const value = mutation.value;

      if (!pathStr || typeof pathStr !== 'string') {
        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'mutation.path is required' });
      }
      if (opName !== 'ADD') {
        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: `Unsupported mutation op: ${opName || 'UNKNOWN'}` });
      }
      const segments = parseMutationPath(pathStr);
      const arr = ensureArrayAtPath(nextContract, segments);
      arr.push(value);
      changed = true;
    }

    if (!changed) {
      return res.status(200).json({ contract_ref: { contract_id: contractId, contract_version: formatSha256(currentHash) } });
    }

    nextContract.updated_at = new Date().toISOString();
    const newHash = calculateHash(nextContract);

    await fsAdapter.writeJson(`state/missions/${missionId}/contracts/versions/${newHash}.json`, nextContract);
    await fsAdapter.writeJson(`state/missions/${missionId}/contracts/latest.json`, nextContract);

    const metaPath = `state/missions/${missionId}/meta.json`;
    const meta = (await fsAdapter.readJson<any>(metaPath)) || { mission_id: missionId };
    meta.contract_ref = { contract_id: contractId, contract_version: formatSha256(newHash) };
    await fsAdapter.writeJson(metaPath, meta);

    return res.status(200).json({ contract_ref: meta.contract_ref });
  } catch (err: any) {
    if (err?.code === 'INVALID_PAYLOAD') {
      return res.status(400).json({ error: err.code, message: err.message, details: err.details });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/contracts/:contractId/latest', async (req: Request, res: Response) => {
  try {
    const contractId = req.params.contractId;
    const c = await findContractLatest(contractId);
    if (!c) return res.status(404).json({ error: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId} not found` });
    return res.status(200).json(c);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/contracts/:contractId/versions/:version', async (req: Request, res: Response) => {
  try {
    const { contractId, version } = req.params;
    const c = await findContractVersion(contractId, version);
    if (!c) return res.status(404).json({ error: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId}@${version} not found` });
    return res.status(200).json(c);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.get('/v1/hcm/contracts/:contractId/versions-int/:contractVersion', async (req: Request, res: Response) => {
  try {
    const contractId = String(req.params.contractId || '').trim();
    const vRaw = String(req.params.contractVersion || '').trim();
    const contractVersion = Number(vRaw);
    if (!contractId) return res.status(400).json({ error: 'INVALID_REQUEST', message: 'contractId required' });
    if (!Number.isInteger(contractVersion) || contractVersion < 1) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'contractVersion must be integer >= 1' });
    }
    const c = await findContractBySemanticVersion(contractId, contractVersion);
    if (!c) return res.status(404).json({ error: 'CONTRACT_NOT_FOUND', message: `Contract ${contractId}#${contractVersion} not found` });
    return res.status(200).json(c);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || String(err) });
  }
});

app.post('/v1/hcm/execute', (req: Request, res: Response) => {
    hcmController.execute(req, res);
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', hcm_root: hcmRoot });
});

// Start Server
// Only start if not imported as a module (allows testing)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`[Arka-HCM] Server running on port ${port}`);
    console.log(`[Arka-HCM] HCM Root: ${hcmRoot}`);
  });
}

export { app };
