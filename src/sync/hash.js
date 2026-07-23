/**
 * Calculate simple hash of content (FNV-1a)
 * @param {string|Uint8Array|Buffer} content
 * @returns {Promise<string>} Hex string of hash
 */
export async function calculateHash(content) {
	let data;

	if (typeof content === "string") {
		data = new TextEncoder().encode(content);
	} else if (Buffer.isBuffer(content)) {
		data = new Uint8Array(content);
	} else if (content) {
		data = content;
	} else {
		return null;
	}

	let hash = 0x811c9dc5;
	// Yield periodically so multi-MB year files do not freeze the UI/tab.
	const YIELD_EVERY = 64 * 1024;
	for (let i = 0; i < data.length; i++) {
		hash ^= data[i];
		hash = Math.imul(hash, 0x01000193);
		if (i > 0 && i % YIELD_EVERY === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Get info for a file (size, hash)
 * @param {string|Buffer|Uint8Array} content
 * @returns {Promise<Object>} { size, hash }
 */
export async function getFileInfo(content) {
	if (content === null || content === undefined) {
		return { hash: null, size: 0 };
	}

	let data;
	if (typeof content === "string") {
		data = new TextEncoder().encode(content);
	} else if (Buffer.isBuffer(content)) {
		data = new Uint8Array(content);
	} else {
		data = content;
	}

	const hash = await calculateHash(data);
	return {
		hash,
		size: data.length,
	};
}
