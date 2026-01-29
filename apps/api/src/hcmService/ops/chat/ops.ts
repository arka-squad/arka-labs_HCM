import { FsAdapter } from '../../fs/fsAdapter';
import { ChatEngine } from '../../chat/ChatEngine';
import { MemoryQueryEngine } from '../../chat/MemoryQueryEngine';

export async function createThread(
    _fsAdapter: FsAdapter,
    chatEngine: ChatEngine,
    missionId: string,
    meta: any
): Promise<any> {
    return await chatEngine.createThread(missionId, meta);
}

export async function appendMessage(
    _fsAdapter: FsAdapter,
    chatEngine: ChatEngine,
    missionId: string,
    threadId: string,
    message: any
): Promise<any> {
    return await chatEngine.appendMessage(missionId, threadId, message);
}

export async function queryMemory(
    _fsAdapter: FsAdapter,
    memoryEngine: MemoryQueryEngine,
    query: string,
    callerId: string,
    missionId: string
): Promise<any> {
    return await memoryEngine.queryMemory(query, callerId, missionId);
}
