
/**
 * Calculate simple hash of content (FNV-1a)
 * @param {string|Uint8Array|Buffer} content 
 * @returns {Promise<string>} Hex string of hash
 */
export async function calculateHash(content) {
    let data;

    if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
    } else if (Buffer.isBuffer(content)) {
        data = new Uint8Array(content);
    } else {
        data = content;
    }

    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

/**
 * Get info for a file (size, hash)
 * @param {string|Buffer} content 
 * @returns {Promise<Object>} { size, hash }
 */
export async function getFileInfo(content) {
    const hash = await calculateHash(content);
    let size = 0;
    if (typeof content === 'string') {
        size = new TextEncoder().encode(content).length;
    } else if (content && content.length) {
        size = content.length;
    }

    return {
        hash,
        size
    };
}
