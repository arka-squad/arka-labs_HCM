import { FsAdapter } from '../fs/fsAdapter';

export async function scaffoldMission(fsAdapter: FsAdapter, missionId: string, meta: any): Promise<void> {
    const missionRoot = `state/missions/${missionId}`;

    // 1. Create Core Directories (Spec 01 / 02 / 03)
    const dirs = [
        missionRoot,                          // root
        `${missionRoot}/evidence`,
        `${missionRoot}/snapshots`,
        `${missionRoot}/contracts/versions`,  // Spec 01
        `${missionRoot}/packs`,               // Spec 01/02
        `${missionRoot}/artifacts/meta`,      // Spec 01
        `${missionRoot}/artifacts/blobs`,     // Spec 01
        `${missionRoot}/chat/threads`         // Spec 03
    ];

    for (const dir of dirs) {
        await fsAdapter.ensureDir(dir);
    }

    // 2. Creating meta.json (Root)
    await fsAdapter.writeJson(`${missionRoot}/meta.json`, {
        ...meta,
        mission_id: missionId,
        schema_version: "1.1", // New versioning
        created_at: new Date().toISOString()
    });

    // 3. Creating empty indexes/config
    await fsAdapter.writeJson(`${missionRoot}/packs_index.json`, { packs: [] });
    await fsAdapter.writeJson(`${missionRoot}/chat/index.json`, { threads: [] });
    
    // 4. Initialize Status
    await fsAdapter.writeJson(`${missionRoot}/status.json`, {
        phase: "init",
        status: "planned",
        health: "ok"
    });
    
    // 5. Initialize Journal
    // FsAdapter.appendJsonLine creates the file if needed.
    await fsAdapter.appendJsonLine(`${missionRoot}/journal.jsonl`, {
        timestamp: new Date().toISOString(),
        author_type: 'system',
        author_id: 'hcm-scaffold',
        entry_type: 'event',
        message: 'Mission scaffolded with Universal Core v1.1 structure'
    });
}
