export function sanitizeQuery(query) {
    if (!query) return query;
    if (typeof query !== 'object') return query;

    // Iterate over array items if it's an array
    if (Array.isArray(query)) {
        for (const item of query) {
            sanitizeQuery(item);
        }
        return query;
    }

    for (const key in query) {
        // Check for dangerous operators
        if (key.startsWith('$')) {
            const lowerKey = key.toLowerCase();
            // Block $where (JS execution), $function, $accumulator (aggregation JS)
            if (lowerKey === '$where' ||
                lowerKey === '$function' ||
                lowerKey === '$accumulator') {
                 throw new Error("Invalid query operator: " + key);
            }
        }

        // Recursively check nested objects
        if (typeof query[key] === 'object' && query[key] !== null) {
            sanitizeQuery(query[key]);
        }
    }
    return query;
}
