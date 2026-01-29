import * as crypto from 'crypto';

/**
 * Calculates a deterministic SHA-256 hash of a JSON object or string.
 * Ensures stable serialization (sorted keys) before hashing.
 */
export function calculateHash(data: unknown): string {
    const stableString = stableStringify(data);
    return crypto.createHash('sha256').update(stableString).digest('hex');
}

/**
 * Deterministic JSON stringify (RFC 8785 / JCS):
 * - Sorts object keys deterministically (Unicode code points).
 * - Preserves arrays order.
 * - Rejects non-finite numbers.
 * - Rejects non-JSON types.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const assertJsonValue = (value: unknown, path = '$'): void => {
    if (value === null) return;
    const t = typeof value;
    if (t === 'string' || t === 'boolean') return;
    if (t === 'number') {
        if (!Number.isFinite(value)) throw new Error(`non_finite_number at ${path}`);
        return;
    }
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) assertJsonValue(value[i], `${path}[${i}]`);
        return;
    }
    if (isPlainObject(value)) {
        for (const [k, v] of Object.entries(value)) assertJsonValue(v, `${path}.${k}`);
        return;
    }
    throw new Error(`non_json_type at ${path}`);
};

const compareUnicodeCodePoints = (a: string, b: string): number => {
    if (a === b) return 0;
    const aIter = a[Symbol.iterator]();
    const bIter = b[Symbol.iterator]();
    while (true) {
        const an = aIter.next();
        const bn = bIter.next();
        const ad = Boolean(an.done);
        const bd = Boolean(bn.done);
        if (ad || bd) return ad && bd ? 0 : ad ? -1 : 1;
        const ac = String(an.value).codePointAt(0) ?? 0;
        const bc = String(bn.value).codePointAt(0) ?? 0;
        if (ac !== bc) return ac < bc ? -1 : 1;
    }
};

const canonicalizeValue = (value: any, stack: Set<unknown>): string => {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'string') return JSON.stringify(value);
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'number') {
        if (!Number.isFinite(value)) throw new Error('non_finite_number');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        if (stack.has(value)) throw new Error('circular_reference');
        stack.add(value);
        const out = `[${value.map((v) => canonicalizeValue(v, stack)).join(',')}]`;
        stack.delete(value);
        return out;
    }
    if (!isPlainObject(value)) throw new Error('non_json_object');
    if (stack.has(value)) throw new Error('circular_reference');
    stack.add(value);
    const keys = Object.keys(value).sort(compareUnicodeCodePoints);
    const out = `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(value[k], stack)}`).join(',')}}`;
    stack.delete(value);
    return out;
};

function stableStringify(data: unknown): string {
    assertJsonValue(data);
    return canonicalizeValue(data as any, new Set());
}
