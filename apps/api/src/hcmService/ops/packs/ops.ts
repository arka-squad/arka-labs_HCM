import { FsAdapter } from '../../fs/fsAdapter';
import { PackEngine } from '../../packs/PackEngine';
import { ArtifactEngine } from '../../artifacts/ArtifactEngine';

export async function storePack(
    _fsAdapter: FsAdapter,
    packEngine: PackEngine,
    missionId: string,
    pack: any
): Promise<any> {
    return await packEngine.storePack(missionId, pack);
}

export async function getPack(
    _fsAdapter: FsAdapter,
    packEngine: PackEngine,
    missionId: string,
    packId: string
): Promise<any> {
    return await packEngine.getPack(missionId, packId);
}

export async function listPacks(
    _fsAdapter: FsAdapter,
    packEngine: PackEngine,
    missionId: string,
    packType?: string
): Promise<any> {
    return await packEngine.listPacks(missionId, { pack_type: packType });
}

export async function putArtifact(
    _fsAdapter: FsAdapter,
    artifactEngine: ArtifactEngine,
    missionId: string,
    content: string,
    meta: any
): Promise<any> {
    return await artifactEngine.putArtifact(missionId, content, meta);
}
