export function buildTreePrefixMap(sessions: any) {
	if (!sessions) return new Map<any, any>();

	const buckets: Record<string, any> = {};
	for (const s of sessions) {
		if (!s.name) continue;
		const bucketKey = `${s.group}||${s.date}`;
		if (!buckets[bucketKey]) buckets[bucketKey] = [];
		buckets[bucketKey].push(s.name);
	}

	const prefixMap = new Map<any, any>();
	const HYPHENS = /[-\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u;
	const isBoundary = (c: any) => !c || /[^\p{L}\p{N}]/u.test(c);

	for (const bucketKey in buckets) {
		const names = buckets[bucketKey];

		// 1. Generate all possible prefixes
		const allPrefixes = new Set<any>();
		for (const name of names) {
			allPrefixes.add(name);
			for (let i = 0; i < name.length; i++) {
				if (HYPHENS.test(name[i])) {
					const extracted = name.substring(0, i);
					const clean = extracted.replace(/[^\p{L}\p{N}]+$/u, "");
					if (clean.length > 2) {
						allPrefixes.add(clean);
					}
				}
			}
		}

		const validPrefixes = Array.from(allPrefixes).sort(
			(a, b) => b.length - a.length,
		);

		// 2. Pre-calculate counts for prefixes that appear more than once
		const prefixCounts = new Map<any, any>();
		for (const p of validPrefixes) {
			let count = 0;
			for (const name of names) {
				if (name.toLowerCase().startsWith(p.toLowerCase())) {
					const nextChar = name[p.length];
					if (isBoundary(nextChar) || p.toLowerCase() === name.toLowerCase()) {
						count++;
					}
				}
			}
			if (count > 1) {
				prefixCounts.set(p, count);
			}
		}

		// 3. Find the final prefix for each name using the pre-calculated counts
		for (const name of names) {
			let finalPrefix = name;
			const nameLower = name.toLowerCase();

			for (const p of validPrefixes) {
				if (nameLower.startsWith(p.toLowerCase())) {
					const nextChar = name[p.length];
					if (
						(isBoundary(nextChar) || p.toLowerCase() === nameLower) &&
						prefixCounts.has(p)
					) {
						finalPrefix = p;
						break;
					}
				}
			}
			prefixMap.set(`${bucketKey}||${name}`, finalPrefix);
		}
	}
	return prefixMap;
}
