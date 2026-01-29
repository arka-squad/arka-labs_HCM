import { FsAdapter } from '../fs/fsAdapter';
import { EvidenceInput, HcmError } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function addEvidence(
  fsAdapter: FsAdapter,
  missionId: string,
  input: EvidenceInput,
  authorId: string
): Promise<{ evidence_id: string; path: string }> {
  
    // Verify mission exists
   const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
         const error: HcmError = {
          code: 'MISSION_NOT_FOUND',
          message: `Mission ${missionId} not found`
      };
      throw error;
    }

  const evidenceId = `ev-${uuidv4().slice(0, 8)}`; // Short ID for readability
  const evidencePath = `state/missions/${missionId}/evidence/${evidenceId}.json`;

  const evidenceData = {
    evidence_id: evidenceId,
    mission_id: missionId,
    ...input,
    created_at: new Date().toISOString(),
    created_by: authorId,
  };

  await fsAdapter.writeJson(evidencePath, evidenceData);

  return { evidence_id: evidenceId, path: evidencePath };
}
