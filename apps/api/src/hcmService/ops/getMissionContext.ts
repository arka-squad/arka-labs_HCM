import { FsAdapter } from '../fs/fsAdapter';
import { MissionContext, JournalEntry, HcmError } from '../types';

export async function getMissionContext(
  fsAdapter: FsAdapter,
  missionId: string
): Promise<MissionContext> {
  const missionPath = `state/missions/${missionId}`;

  // Check if mission exists first by checking meta.json
  const metaPath = `${missionPath}/meta.json`;
  if (!(await fsAdapter.exists(metaPath))) {
      // Throw MISSION_NOT_FOUND if meta.json is missing
      const error: HcmError = {
          code: 'MISSION_NOT_FOUND',
          message: `Mission ${missionId} not found (meta.json missing)`
      };
      throw error;
  }

  // Parallel reads for efficiency
  const [meta, status, journal_tail, decisions, next_actions] = await Promise.all([
    fsAdapter.readJson<Record<string, unknown>>(metaPath),
    fsAdapter.readJson<Record<string, unknown>>(`${missionPath}/status.json`).catch(() => ({})), // Optional
    fsAdapter.readJsonLines<JournalEntry>(`${missionPath}/journal.jsonl`, 50), // Last 50 entries
    fsAdapter.readJson<Record<string, unknown>>(`${missionPath}/decisions.json`).then(d => (d as any).decisions || []).catch(() => []), // Expecting { decisions: [...] }
    fsAdapter.readJson<Record<string, unknown>>(`${missionPath}/next_actions.json`).then(n => (n as any).next_actions || []).catch(() => []), // Expecting { next_actions: [...] }
  ]);

  return {
    mission_id: missionId,
    meta,
    status,
    journal_tail,
    decisions: decisions as Record<string, unknown>[],
    next_actions: next_actions as Record<string, unknown>[],
  };
}
