import { FsAdapter } from '../fs/fsAdapter';
import { HcmError } from '../types';

export async function dayRollup(
  fsAdapter: FsAdapter,
  missionId: string,
  date: string // YYYY-MM-DD
): Promise<{ snapshot_path: string }> {
    // 1. Validate Mission
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
         throw { code: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` } as HcmError;
    }

    // 2. Read current state components
    const statusPath = `state/missions/${missionId}/status.json`;
    const nextActionsPath = `state/missions/${missionId}/next_actions.json`;
    const decisionsPath = `state/missions/${missionId}/decisions.json`;
    
    // We do a best-effort read
    const [status, nextActions, decisions] = await Promise.all([
        fsAdapter.readJson(statusPath).catch(() => ({})),
        fsAdapter.readJson(nextActionsPath).catch(() => ({})),
        fsAdapter.readJson(decisionsPath).catch(() => ({}))
    ]);

    // 3. Create Snapshot Data
    const snapshotData = {
        snapshot_date: date,
        generated_at: new Date().toISOString(),
        mission_id: missionId,
        status,
        open_actions: (nextActions as any).next_actions || [],
        decisions_summary: (decisions as any).decisions ? (decisions as any).decisions.length : 0
    };

    // 4. Write Snapshot
    const snapshotPath = `state/missions/${missionId}/snapshots/${date}.snapshot.json`;
    await fsAdapter.writeJson(snapshotPath, snapshotData);
    
    return { snapshot_path: snapshotPath };
}