import { FsAdapter } from '../fs/fsAdapter';
import { HindexEngine } from '../hindex/HindexEngine';

export async function search(
  _fsAdapter: FsAdapter,
  hindexEngine: HindexEngine,
  query: string,
  callerId: string
): Promise<any> {
    
    // Ensure engine is initialized (it handles its own ready state check usually, but here we call search directly)
    // The engine's search method calls init() if needed.
    
    return await hindexEngine.search(query, callerId);
}