import { FsAdapter } from '../fs/fsAdapter';
import { NextActionUpdate, HcmError } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function updateNextActions(
  fsAdapter: FsAdapter,
  missionId: string,
  updates: NextActionUpdate[]
): Promise<void> {
  const actionsPath = `state/missions/${missionId}/next_actions.json`;

  // Verify mission
  const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
         const error: HcmError = {
          code: 'MISSION_NOT_FOUND',
          message: `Mission ${missionId} not found`
      };
      throw error;
    }

  let currentActions: { next_actions: any[] } = { next_actions: [] };
  
  try {
      if (await fsAdapter.exists(actionsPath)) {
        currentActions = await fsAdapter.readJson(actionsPath);
      }
  } catch (e) {
      // If error reading, assume empty or corrupt, but safer to fail if critical
      // Here we assume if it exists we should be able to read it.
      throw e; 
  }

  const actionsMap = new Map<string, any>();
  currentActions.next_actions.forEach((a: any) => actionsMap.set(a.action_id, a));

  for (const update of updates) {
    if (update.action_id && actionsMap.has(update.action_id)) {
      // Update existing
      const existing = actionsMap.get(update.action_id);
      actionsMap.set(update.action_id, { ...existing, ...update, updated_at: new Date().toISOString() });
    } else {
      // Create new
      const newId = update.action_id || `act-${uuidv4().slice(0, 8)}`;
      actionsMap.set(newId, {
        action_id: newId,
        ...update,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  const newActionsList = Array.from(actionsMap.values());
  await fsAdapter.writeJson(actionsPath, { next_actions: newActionsList });
}
