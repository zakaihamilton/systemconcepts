import { calculateHash } from "./hash";

/**
 * Stringify an object with keys sorted deterministically
 * @param {any} obj 
 * @returns {string} Canonoical JSON string
 */
export function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(item => canonicalStringify(item)).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    return '{' + keys.map(key => {
        const val = canonicalStringify(obj[key]);
        return JSON.stringify(key) + ':' + val;
    }).join(',') + '}';
}

/**
 * Calculate hash of an object based on its canonical string representation
 * @param {Object} obj 
 * @returns {Promise<string>} Hash of the canonical string
 */
export async function calculateCanonicalHash(obj) {
    if (!obj) return null;
    const str = canonicalStringify(obj);
    return await calculateHash(str);
}
