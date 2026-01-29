import { FsAdapter } from '../fs/fsAdapter';
import { HcmError } from '../types';

export async function prepareDayContext(
  fsAdapter: FsAdapter,
  missionId: string,
  date: string
): Promise<any> {
    const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
         throw { code: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` } as HcmError;
    }

    // Fallback: Read current next_actions (todo)
    const nextActionsPath = `state/missions/${missionId}/next_actions.json`;
    const actionsData = await fsAdapter.readJson<{next_actions: any[]}>(nextActionsPath).catch(() => ({ next_actions: [] }));
    const todo = (actionsData.next_actions || []).filter((a: any) => a.status === 'todo' || a.status === 'in_progress');
    
    return {
        mission_id: missionId,
        date: date,
        focus: "Execute open actions",
        context_inputs: {
            open_actions: todo
        }
    };
}