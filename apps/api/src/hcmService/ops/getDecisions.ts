import { FsAdapter } from '../fs/fsAdapter';
import { HcmError } from '../types';

export async function getDecisions(
  fsAdapter: FsAdapter,
  missionId: string,
  filters?: { status?: string }
): Promise<any[]> {
    const decisionsPath = `state/missions/${missionId}/decisions.json`;
    
    if (!(await fsAdapter.exists(decisionsPath))) {
        // Verification d'existence de la mission
        const metaPath = `state/missions/${missionId}/meta.json`;
        if (!(await fsAdapter.exists(metaPath))) {
             const error: HcmError = { code: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` };
             throw error;
        }
        return [];
    }

    try {
        const content = await fsAdapter.readJson<{ decisions: any[] }>(decisionsPath);
        let decisions = content.decisions || [];
        
        if (filters && filters.status) {
            decisions = decisions.filter(d => d.status === filters.status);
        }
        return decisions;
    } catch (e) {
        return [];
    }
}