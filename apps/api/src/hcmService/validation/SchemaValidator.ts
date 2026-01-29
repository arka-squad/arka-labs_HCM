import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { HcmError } from '../types';

export class SchemaValidator {
    private ajv: Ajv;
    private validators: Map<string, ValidateFunction> = new Map();

    constructor() {
        this.ajv = new Ajv({ strict: true, allErrors: true });
        addFormats(this.ajv);
        
        // Pre-load default schemas (stubs based on specs)
        this.registerSchema('context_factors', {
            type: "object",
            properties: {
                project_id: { type: "string" },
                mission_id: { type: "string" },
                environment: { type: "string", enum: ["dev", "staging", "prod"] },
                factors: { type: "object" }
            },
            required: ["project_id", "mission_id"],
            additionalProperties: true
        });

        this.registerSchema('chat_thread', {
             type: "object",
             properties: {
                 thread_id: { type: "string" },
                 participants: { type: "array", items: { type: "string" } },
                 messages: { type: "array" }
             },
             required: ["thread_id"],
             additionalProperties: true
        });
    }

    public registerSchema(name: string, schema: any) {
        try {
            const validate = this.ajv.compile(schema);
            this.validators.set(name, validate);
        } catch (e) {
            console.error(`Failed to compile schema ${name}:`, e);
            throw new Error(`Schema compilation failed for ${name}`);
        }
    }

    public validate(schemaName: string, data: unknown): void {
        const validate = this.validators.get(schemaName);
        if (!validate) {
            throw { 
                code: 'INTERNAL_ERROR', 
                message: `Validator not found for schema: ${schemaName}` 
            } as HcmError;
        }

        const valid = validate(data);
        if (!valid) {
            throw {
                code: 'INVALID_PAYLOAD',
                message: `Validation failed for ${schemaName}`,
                details: { errors: validate.errors }
            } as HcmError;
        }
    }
}
