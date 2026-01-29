import { FsAdapter } from '../fs/fsAdapter';
import { calculateHash } from '../utils/hashing';
import { HcmError } from '../types';

export class ContractEngine {
    private fsAdapter: FsAdapter;

    constructor(fsAdapter: FsAdapter) {
        this.fsAdapter = fsAdapter;
    }

    async getLatest(missionId: string): Promise<any> {
        const latestPath = `state/missions/${missionId}/contracts/latest.json`;
        try {
            if (!(await this.fsAdapter.exists(latestPath))) {
                return null;
            }
            return await this.fsAdapter.readJson(latestPath);
        } catch (e) {
            // If folder structure missing or other read error
            return null;
        }
    }

    async createVersion(missionId: string, patch: any, expectedBaseHash: string | null): Promise<any> {
        // 1. Load current state
        const currentContract = await this.getLatest(missionId);
        
        let currentHash = null;
        if (currentContract) {
            currentHash = calculateHash(currentContract);
        }

        // 2. Optimistic Locking Check
        if (expectedBaseHash !== currentHash) {
            const error: HcmError = {
                code: 'CONFLICTING_UPDATE',
                message: `Contract version conflict. Expected base hash ${expectedBaseHash}, but current is ${currentHash}`,
                details: { current_hash: currentHash, expected_hash: expectedBaseHash }
            };
            throw error;
        }

        // 3. Apply Patch (Deep merge or simple override depending on spec)
        // Spec says "Applique le patch (merge)". Simple spread for v1.
        // If current is null, new is patch.
        const newContract = {
            ...(currentContract || {}),
            ...patch,
            updated_at: new Date().toISOString()
        };

        // 4. Calculate new hash
        const newHash = calculateHash(newContract);

        // 5. Write Immutable Version
        // Ensure directory exists
        const versionDir = `state/missions/${missionId}/contracts/versions`;
        // We use a dummy file check to ensure dir, or rely on writeJson creating it.
        // FsAdapter writeJson handles mkdir recursive.
        
        const versionPath = `${versionDir}/${newHash}.json`;
        await this.fsAdapter.writeJson(versionPath, newContract);

        // 6. Update Pointer (latest.json)
        const latestPath = `state/missions/${missionId}/contracts/latest.json`;
        await this.fsAdapter.writeJson(latestPath, newContract);

        return {
            contract: newContract,
            hash: newHash,
            version_path: versionPath
        };
    }
    
    // Helper to append audit log (simple re-versioning with just audit changes?)
    // Or separate file? Spec says "HCM_CONTRACT_APPEND_AUDIT".
    // Usually audit log is part of the contract object in Arka.
    // So it's just a createVersion call where patch = { audit: [...newAudit] }
}
