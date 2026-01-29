import { FsAdapter } from '../fs/fsAdapter';
import { SchemaValidator } from '../validation/SchemaValidator';
import { v4 as uuidv4 } from 'uuid';
import { HcmError } from '../types';
import { calculateHash } from '../utils/hashing';

export class ChatEngine {
    private fsAdapter: FsAdapter;
    private validator: SchemaValidator;

    constructor(fsAdapter: FsAdapter) {
        this.fsAdapter = fsAdapter;
        this.validator = new SchemaValidator();
        try {
            this.validator.registerSchema('chat_message', {
                type: "object",
                properties: {
                    content: { type: "string" },
                    role: { type: "string", enum: ["user", "assistant", "system"] }
                },
                required: ["content", "role"],
                additionalProperties: true
            });
        } catch (e) {
            // Already registered
        }
    }

    async createThread(missionId: string, meta: any): Promise<{ thread_id: string }> {
        // 1. Generate ID
        const threadId = meta.thread_id || `thread-${uuidv4().slice(0, 8)}`;
        
        // 2. Validate Meta (Schema 'chat_thread')
        // FIX: Using correct variable name 'threadId'
        const threadData = { ...meta, thread_id: threadId, mission_id: missionId, created_at: new Date().toISOString() };
        try {
            this.validator.validate('chat_thread', threadData);
        } catch (e: any) {
            if (e.code === 'INVALID_PAYLOAD') throw e;
        }

        // 3. Write Meta
        const threadDir = `state/missions/${missionId}/chat/threads/${threadId}`;
        await this.fsAdapter.writeJson(`${threadDir}/meta.json`, threadData);
        
        // 4. Init messages file (Empty) -> Skipped, append will create

        return { thread_id: threadId };
    }

    async appendMessage(missionId: string, threadId: string, message: any): Promise<{ message_id: string }> {
        // 1. Validate Schema
        try {
            this.validator.validate('chat_message', message);
        } catch (e: any) {
            if (e.code === 'INVALID_PAYLOAD') throw e;
        }

        const msgId = `msg-${uuidv4().slice(0, 8)}`;
        const baseMessage = {
            ...message,
            message_id: msgId,
            timestamp: new Date().toISOString()
        };

        // 2. Compute deterministic hash (content + author + timestamp + mission/thread)
        const hashPayload = {
            mission_id: missionId,
            thread_id: threadId,
            role: baseMessage.role,
            content: baseMessage.content,
            timestamp: baseMessage.timestamp
        };
        const hash = calculateHash(hashPayload);

        const finalMessage = {
            ...baseMessage,
            hash
        };

        const messagesPath = `state/missions/${missionId}/chat/threads/${threadId}/messages.jsonl`;
        
        // Check if thread exists
        const metaPath = `state/missions/${missionId}/chat/threads/${threadId}/meta.json`;
        if (!(await this.fsAdapter.exists(metaPath))) {
             throw { code: 'MISSION_NOT_FOUND', message: `Thread ${threadId} not found` } as HcmError;
        }

        await this.fsAdapter.appendJsonLine(messagesPath, finalMessage);
        
        return { message_id: msgId };
    }

    async listThreads(missionId: string): Promise<string[]> {
        const chatRoot = `state/missions/${missionId}/chat/threads`;
        if (!(await this.fsAdapter.exists(chatRoot))) return [];
        
        // Scan dirs. listFilesRecursive returns files.
        // Look for */meta.json
        const files = await this.fsAdapter.listFilesRecursive(chatRoot);
        const threads = new Set<string>();
        files.forEach(f => {
            const parts = f.split('/');
            if (parts[parts.length - 1] === 'meta.json') {
                threads.add(parts[parts.length - 2]);
            }
        });
        return Array.from(threads);
    }
}
