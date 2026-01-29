import { FsAdapter } from '../../fs/fsAdapter';
import { ContractEngine } from '../../contracts/ContractEngine';

export async function createContractVersion(
    _fsAdapter: FsAdapter,
    contractEngine: ContractEngine,
    missionId: string,
    patch: any,
    expectedBaseHash: string | null
): Promise<any> {
    // Delegates to Engine
    return await contractEngine.createVersion(missionId, patch, expectedBaseHash);
}