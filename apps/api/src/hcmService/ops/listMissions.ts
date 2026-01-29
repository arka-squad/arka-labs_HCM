import { FsAdapter } from '../fs/fsAdapter';

export async function listMissions(fsAdapter: FsAdapter, opts: { business_id?: string | null } = {}): Promise<string[]> {
    const missionsRoot = 'state/missions';
    if (!(await fsAdapter.exists(missionsRoot))) {
        return [];
    }
    
    // Scan recursif mais on filtre pour ne garder que les ID
    // listFilesRecursive retourne par exemple "state/missions/abc/meta.json"
    const files = await fsAdapter.listFilesRecursive(missionsRoot);
    const missionIds = new Set<string>();
    const targetBusiness = (opts.business_id || '').trim();
    
    for (const file of files) {
        const parts = file.split('/');
        // format attendu: state/missions/<mission_id>/meta.json
        if (parts.length >= 4 && parts[parts.length - 1] === 'meta.json') {
            const missionId = parts[2];
            if (!targetBusiness) {
                missionIds.add(missionId);
                continue;
            }
            // Filtrage par business_id en lisant le meta.json
            try {
                const meta = await fsAdapter.readJson<any>(file);
                const metaBusiness = String(meta?.business_id || '').trim();
                if (!metaBusiness || metaBusiness === targetBusiness) {
                    missionIds.add(missionId);
                }
            } catch {
                // on ignore en cas d'erreur de lecture
            }
        }
    }

    return Array.from(missionIds).sort();
}
