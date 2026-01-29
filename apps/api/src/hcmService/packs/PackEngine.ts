import { FsAdapter } from '../fs/fsAdapter';
import { SchemaValidator } from '../validation/SchemaValidator';
import { calculateHash } from '../utils/hashing';
import { HcmError } from '../types';

export class PackEngine {
    private fsAdapter: FsAdapter;
    private validator: SchemaValidator;

    constructor(fsAdapter: FsAdapter) {
        this.fsAdapter = fsAdapter;
        this.validator = new SchemaValidator(); // Loads default schemas
    }

    async storePack(missionId: string, pack: any): Promise<{ pack_id: string; hash: string }> {
        const packMeta = pack?.pack_meta || {};
        const packId = pack?.pack_id || packMeta.pack_id;
        if (!packId) {
            const error: HcmError = {
                code: 'INVALID_PAYLOAD',
                message: 'pack_id (or pack_meta.pack_id) required',
            };
            throw error;
        }

        // 1. Validate Schema
        const type = packMeta.pack_type || packMeta.type;
        if (type) {
            // Try to validate if schema exists.
            // For now, we only have stubs. If type matches a stub, we validate.
            // We swallow error if schema not found (for V1 flexibility), BUT validation failure must throw.
            try {
                this.validator.validate(type, pack.payload); // Validate payload against type schema
            } catch (e: any) {
                if (e.code === 'INVALID_PAYLOAD') {
                    throw e; // Rethrow validation errors
                }
                // Ignore "Validator not found" for unknown types in V1.1
            }
        }
        
        // 2. Calculate Hash
        const hash = calculateHash(pack);
        
        // 3. Idempotence Check
        const packPath = `state/missions/${missionId}/packs/${packId}.json`;
        
        if (await this.fsAdapter.exists(packPath)) {
            const existingPack = await this.fsAdapter.readJson<any>(packPath);
            const existingHash = calculateHash(existingPack);
            
            if (existingHash === hash) {
                return { pack_id: packId, hash }; // Idempotent success
            } else {
                const error: HcmError = {
                    code: 'CONFLICTING_UPDATE',
                    message: `Pack ${packId} exists with different content. Packs are immutable.`,
                    details: { existing_hash: existingHash, new_hash: hash }
                };
                throw error;
            }
        }

        // 4. Store Pack
        await this.fsAdapter.writeJson(packPath, pack);

        // 5. Update Index
        const indexPath = `state/missions/${missionId}/packs_index.json`;
        let index = { packs: [] as any[] };
        try {
            if (await this.fsAdapter.exists(indexPath)) {
                index = await this.fsAdapter.readJson(indexPath);
            }
        } catch {}
        
        index.packs.push({ pack_id: packId, type, hash, stored_at: new Date().toISOString() });
        await this.fsAdapter.writeJson(indexPath, index);

        return { pack_id: packId, hash };
    }

    async getPack(missionId: string, packId: string): Promise<any> {
        const packPath = `state/missions/${missionId}/packs/${packId}.json`;
        if (!(await this.fsAdapter.exists(packPath))) {
            return null;
        }
        return await this.fsAdapter.readJson(packPath);
    }

    async listPacks(
        missionId: string,
        opts: { pack_type?: string } = {}
    ): Promise<Array<{ pack_id: string; type?: string; hash?: string; stored_at?: string }>> {
        const indexPath = `state/missions/${missionId}/packs_index.json`;
        if (!(await this.fsAdapter.exists(indexPath))) return [];

        let index: any = { packs: [] };
        try {
            index = await this.fsAdapter.readJson(indexPath);
        } catch {
            return [];
        }

        const packs = Array.isArray(index?.packs) ? index.packs : [];
        if (!opts.pack_type) return packs;

        const target = String(opts.pack_type).toUpperCase();
        return packs.filter((p: any) => String(p?.type || p?.pack_type || '').toUpperCase() === target);
    }
}
