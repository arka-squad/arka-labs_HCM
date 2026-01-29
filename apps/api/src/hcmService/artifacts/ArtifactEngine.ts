import { FsAdapter } from '../fs/fsAdapter';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class ArtifactEngine {
    private fsAdapter: FsAdapter;

    constructor(fsAdapter: FsAdapter) {
        this.fsAdapter = fsAdapter;
    }

    private calculateBlobHash(content: string | Buffer): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    async putArtifact(
        missionId: string,
        content: string,
        meta: Record<string, any>,
        opts: { artifact_id?: string | null } = {}
    ): Promise<{ artifact_id: string; blob_hash: string }> {
        const blobHash = this.calculateBlobHash(content);
        const requested = typeof opts.artifact_id === 'string' && opts.artifact_id.trim() ? opts.artifact_id.trim() : null;
        const artifactId = requested || `art-${uuidv4().slice(0, 8)}`; // Short ID

        // 1. Store Blob (Deduplication)
        // Global blob store or per-mission? Spec 01 says `artifacts/blobs`.
        // Let's assume per-mission for now to keep missions isolated (easier archive),
        // OR global if we want cross-mission dedupe.
        // Spec 01 (Phase 1.1 A report) tree view showed `state/missions/<id>/artifacts/blobs`.
        // So it is PER MISSION.
        
        const blobPath = `state/missions/${missionId}/artifacts/blobs/${blobHash}`;
        
        // Only write if not exists
        if (!(await this.fsAdapter.exists(blobPath))) {
            await this.fsAdapter.writeJson(blobPath, content); // Using writeJson for simplicity if content is string/JSON, BUT spec implies binary support?
            // "Upload d'un fichier PDF (Simulé)".
            // writeJson stringifies. If content is raw string/buffer, we need writeRaw.
            // FsAdapter currently only has writeJson/appendJsonLine.
            // Let's assume content is treated as text/base64 for V1.
            // Or extend FsAdapter?
            // Hotfix: treating content as text string for now.
        }

        // 2. Store Metadata (idempotent when artifact_id is provided)
        const metaPath = `state/missions/${missionId}/artifacts/meta/${artifactId}.json`;
        if (requested && (await this.fsAdapter.exists(metaPath))) {
            const existingMeta = await this.fsAdapter.readJson<any>(metaPath);
            const existingHash = existingMeta?.blob_hash ? String(existingMeta.blob_hash) : null;
            if (existingHash && existingHash === blobHash) {
                return { artifact_id: artifactId, blob_hash: blobHash };
            }
            const err: any = new Error('artifact_id_conflict');
            err.code = 'CONFLICTING_UPDATE';
            err.details = { artifact_id: artifactId, existing_blob_hash: existingHash, new_blob_hash: blobHash };
            throw err;
        }

        const artifactMeta = {
            artifact_id: artifactId,
            mission_id: missionId,
            blob_hash: blobHash,
            created_at: new Date().toISOString(),
            ...meta
        };

        await this.fsAdapter.writeJson(metaPath, artifactMeta);

        return { artifact_id: artifactId, blob_hash: blobHash };
    }

    async getArtifact(missionId: string, artifactId: string): Promise<any> {
        const metaPath = `state/missions/${missionId}/artifacts/meta/${artifactId}.json`;
        if (!(await this.fsAdapter.exists(metaPath))) {
            return null;
        }
        
        const meta = await this.fsAdapter.readJson<any>(metaPath);
        const blobPath = `state/missions/${missionId}/artifacts/blobs/${meta.blob_hash}`;
        
        // Lazy load content
        let content = null;
        if (await this.fsAdapter.exists(blobPath)) {
            content = await this.fsAdapter.readJson(blobPath); // Assuming text/json content
        }

        return { meta, content };
    }
}
