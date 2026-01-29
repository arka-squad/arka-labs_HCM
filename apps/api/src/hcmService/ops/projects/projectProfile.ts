import { FsAdapter } from '../../fs/fsAdapter';
import { calculateHash } from '../../utils/hashing';
import type { HcmError, HcmRequest, ProjectPolicy, ProjectProfile, ProjectProfileDoc, ProjectProfileSummary } from '../../types';

const SHA256_PREFIX = 'sha256:';

function stripSha256Prefix(value: string) {
  const v = String(value || '').trim();
  return v.startsWith(SHA256_PREFIX) ? v.slice(SHA256_PREFIX.length) : v;
}

function formatSha256(hex: string) {
  const h = String(hex || '').trim();
  return h.startsWith(SHA256_PREFIX) ? h : `${SHA256_PREFIX}${h}`;
}

function createError(code: HcmError['code'], message: string, details?: Record<string, unknown>): HcmError {
  return { code, message, details };
}

function normalizeProjectId(raw: unknown): string {
  const projectId = String(raw || '').trim();
  if (!projectId) throw createError('INVALID_PAYLOAD', 'project_id required');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(projectId)) {
    throw createError('INVALID_PAYLOAD', 'project_id must be a safe slug (a-zA-Z0-9._-)');
  }
  return projectId;
}

function normalizeProfile(raw: unknown, projectNameHint?: unknown): ProjectProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw createError('INVALID_PAYLOAD', 'profile must be a JSON object');
  }
  const profile = { ...(raw as any) } as ProjectProfile;

  if (!profile.project_name) {
    const hinted =
      String((projectNameHint as any) ?? profile.projectName ?? profile.name ?? '').trim();
    if (hinted) (profile as any).project_name = hinted;
  }

  const projectName = String(profile.project_name || '').trim();
  if (!projectName) throw createError('INVALID_PAYLOAD', 'profile.project_name required');
  profile.project_name = projectName;

  const businessId = String((profile as any).business_id || '').trim();
  if (businessId) (profile as any).business_id = businessId;

  if (Object.prototype.hasOwnProperty.call(profile as any, 'policy')) {
    (profile as any).policy = normalizePolicy((profile as any).policy);
  }
  return profile;
}

function normalizeAllowedTermIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw createError('INVALID_PAYLOAD', 'profile.policy.allowed_term_ids must be an array of strings');
  }
  const normalized = raw
    .map((v) => String(v ?? '').trim().toUpperCase())
    .filter((v) => v.length > 0);
  const unique = Array.from(new Set(normalized));
  unique.sort();
  return unique;
}

function normalizePolicy(raw: unknown): ProjectPolicy | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw createError('INVALID_PAYLOAD', 'profile.policy must be a JSON object');
  }

  const policy = { ...(raw as any) } as ProjectPolicy;

  if (Object.prototype.hasOwnProperty.call(policy as any, 'enforce_scope') && typeof (policy as any).enforce_scope !== 'boolean') {
    throw createError('INVALID_PAYLOAD', 'profile.policy.enforce_scope must be a boolean');
  }

  if (Object.prototype.hasOwnProperty.call(policy as any, 'allowed_term_ids')) {
    (policy as any).allowed_term_ids = normalizeAllowedTermIds((policy as any).allowed_term_ids);
  }

  if ((policy as any).enforce_scope === true) {
    const allowed = Array.isArray((policy as any).allowed_term_ids) ? (policy as any).allowed_term_ids : [];
    if (allowed.length === 0) {
      throw createError(
        'INVALID_PAYLOAD',
        'profile.policy.allowed_term_ids must be a non-empty array when enforce_scope=true',
      );
    }
  }

  return policy;
}

function getPaths(projectId: string) {
  const base = `domain/projects/${projectId}/profile`;
  return {
    base,
    latest: `${base}/latest.json`,
    versionsDir: `${base}/versions`,
  };
}

async function readLatestIfExists(fsAdapter: FsAdapter, latestPath: string): Promise<ProjectProfileDoc | null> {
  if (!(await fsAdapter.exists(latestPath))) return null;
  try {
    return await fsAdapter.readJson<ProjectProfileDoc>(latestPath);
  } catch {
    return null;
  }
}

export async function putProjectProfile(
  fsAdapter: FsAdapter,
  input: { project_id: unknown; project_name?: unknown; profile: unknown; expected_base_hash?: unknown },
  caller: HcmRequest['caller'],
): Promise<ProjectProfileDoc> {
  const projectId = normalizeProjectId(input.project_id);
  const profile = normalizeProfile(input.profile, input.project_name);
  const expectedRaw = (input as any).expected_base_hash;
  const expectedBaseHash =
    expectedRaw === undefined ? undefined : expectedRaw === null ? null : String(expectedRaw || '').trim();

  const paths = getPaths(projectId);
  const latest = await readLatestIfExists(fsAdapter, paths.latest);
  const currentHex = latest?.meta?.version_hash ? stripSha256Prefix(String(latest.meta.version_hash)) : null;

  if (expectedBaseHash !== undefined) {
    const expectedHex = expectedBaseHash === null ? null : stripSha256Prefix(expectedBaseHash);
    if (expectedHex !== currentHex) {
      throw createError('CONFLICTING_UPDATE', 'project_profile version conflict', {
        expected_base_hash: expectedHex ? formatSha256(expectedHex) : null,
        current_hash: currentHex ? formatSha256(currentHex) : null,
      });
    }
  }

  const contentHashHex = calculateHash({ project_id: projectId, profile });
  const versionHash = formatSha256(contentHashHex);
  const versionPath = `${paths.versionsDir}/${contentHashHex}.json`;

  if (await fsAdapter.exists(versionPath)) {
    const versionDoc = await fsAdapter.readJson<ProjectProfileDoc>(versionPath);
    await fsAdapter.writeJsonAtomic(paths.latest, versionDoc);
    return versionDoc;
  }

  const now = new Date().toISOString();
  const doc: ProjectProfileDoc = {
    schema_version: '1.1',
    project_id: projectId,
    profile,
    meta: {
      version_hash: versionHash,
      created_at: now,
      created_by: { type: caller.type, id: caller.id },
      supersedes: latest?.meta?.version_hash ?? null,
    },
  };

  await fsAdapter.writeJsonAtomic(versionPath, doc);
  await fsAdapter.writeJsonAtomic(paths.latest, doc);

  return doc;
}

export async function getProjectProfile(
  fsAdapter: FsAdapter,
  input: { project_id: unknown },
): Promise<ProjectProfileDoc | null> {
  const projectId = normalizeProjectId(input.project_id);
  const paths = getPaths(projectId);
  const doc = await readLatestIfExists(fsAdapter, paths.latest);
  return doc;
}

export async function listProjectProfiles(fsAdapter: FsAdapter): Promise<ProjectProfileSummary[]> {
  const files = await fsAdapter.listFilesRecursive('domain/projects');
  const latestFiles = files.filter((p) => p.endsWith('/profile/latest.json'));

  const items: ProjectProfileSummary[] = [];

  for (const filePath of latestFiles) {
    try {
      const doc = await fsAdapter.readJson<ProjectProfileDoc>(filePath);
      const projectId = String(doc.project_id || '').trim();
      const name = String(doc.profile?.project_name || '').trim();
      const versionHash = String(doc.meta?.version_hash || '').trim();
      const createdAt = String(doc.meta?.created_at || '').trim();
      if (!projectId || !name || !versionHash || !createdAt) continue;
      items.push({ project_id: projectId, project_name: name, version_hash: versionHash, created_at: createdAt });
    } catch {
      // ignore broken entries
    }
  }

  items.sort((a, b) => a.project_name.localeCompare(b.project_name));
  return items;
}
