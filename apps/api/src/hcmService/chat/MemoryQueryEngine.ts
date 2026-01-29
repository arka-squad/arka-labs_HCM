import { HindexEngine } from '../hindex/HindexEngine';

export class MemoryQueryEngine {
    private hindex: HindexEngine;

    constructor(hindex: HindexEngine) {
        this.hindex = hindex;
    }

    async queryMemory(query: string, callerId: string, missionId: string): Promise<any> {
        // 1. Search via Hindex (Classification + Scope + Read)
        // Hindex search currently returns { query, classification, routing, count, results: [{source, content}] }
        const searchResult = await this.hindex.search(query, callerId);

        // 2. Assemble Context Pack
        const contextPack = {
            context_pack: {
                source: "HCM",
                class: searchResult.classification,
                mission_id: missionId,
                entries: searchResult.results.map((res: any) => ({
                    source_path: res.source,
                    content: res.content, // Could be array (jsonl) or object
                    retrieved_at: new Date().toISOString()
                })),
                metadata: {
                    extraction_mode: searchResult.routing, // deterministic
                    timestamp: new Date().toISOString(),
                    query: query
                }
            }
        };

        return contextPack;
    }
}
