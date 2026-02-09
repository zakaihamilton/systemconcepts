// Split by double newlines, but preserve code blocks
export const splitSmart = (txt) => {
    const chunks = [];
    let remaining = txt;
    while (remaining) {
        const fenceIdx = remaining.indexOf("```");
        if (fenceIdx === -1) {
            const parts = remaining.split(/\n\n+/).filter(p => p.trim());
            chunks.push(...parts);
            break;
        }
        const before = remaining.substring(0, fenceIdx);
        if (before.trim()) {
            const parts = before.split(/\n\n+/).filter(p => p.trim());
            chunks.push(...parts);
        }
        const openFenceEnd = remaining.indexOf("\n", fenceIdx);
        if (openFenceEnd === -1) {
            chunks.push(remaining.substring(fenceIdx));
            break;
        }
        const closeFenceIdx = remaining.indexOf("```", openFenceEnd);
        if (closeFenceIdx === -1) {
            chunks.push(remaining.substring(fenceIdx));
            break;
        }
        const endOfFence = closeFenceIdx + 3;
        const codeBlock = remaining.substring(fenceIdx, endOfFence);
        chunks.push(codeBlock);
        remaining = remaining.substring(endOfFence).trimStart();
    }
    return chunks;
};

export const mergeChunks = (chunks) => {
    if (chunks.length === 0) return chunks;
    const merged = [chunks[0]];
    const getType = (text) => {
        const firstLine = text.split('\n')[0].trim();
        if (/^```/.test(firstLine)) return 'code';
        if (/^[-*]\s/.test(firstLine)) return 'ul';
        if (/^>\s/.test(firstLine)) return 'quote';
        if (/^\d+\.\s/.test(firstLine)) return 'ol';
        return 'text';
    };
    for (let i = 1; i < chunks.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = chunks[i];
        const prevType = getType(prev);
        const currType = getType(curr);
        if (prevType === currType && ['ul', 'ol', 'quote'].includes(currType)) {
            merged[merged.length - 1] += "\n\n" + curr;
        } else {
            merged.push(curr);
        }
    }
    return merged;
};
