import { FsAdapter } from '../fs/fsAdapter';
import { JournalEntry, HcmError } from '../types';

export async function appendJournal(
  fsAdapter: FsAdapter,
  missionId: string,
  entry: JournalEntry
): Promise<JournalEntry> {
    
  if (!entry.message || !entry.author_id) {
       const error: HcmError = {
          code: 'INVALID_PAYLOAD',
          message: 'Journal entry requires message and author_id'
      };
      throw error;
  }

  const finalEntry: JournalEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  const journalPath = `state/missions/${missionId}/journal.jsonl`;
  
  // Verify mission exists (optional but good practice, or rely on fsAdapter error if dir missing)
   const metaPath = `state/missions/${missionId}/meta.json`;
    if (!(await fsAdapter.exists(metaPath))) {
         const error: HcmError = {
          code: 'MISSION_NOT_FOUND',
          message: `Mission ${missionId} not found`
      };
      throw error;
    }

  await fsAdapter.appendJsonLine(journalPath, finalEntry);
  return finalEntry;
}
