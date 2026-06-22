import type { SessionMetadata, StorageItem } from "../../../types/domain";

export function getYearFingerprint(items: StorageItem[] = []) {
	return items
		.map((item) => ({
			name: item.name,
			type: item.type || item.stat?.type || "",
			size: item.size || item.stat?.size || 0,
			mtimeMs: item.mtimeMs || item.stat?.mtimeMs || 0,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getMetadataFileFingerprint(file?: StorageItem | null) {
	if (!file) return null;
	return {
		name: file.name,
		type: file.type || file.stat?.type || "",
		size: file.size || file.stat?.size || 0,
		mtimeMs: file.mtimeMs || file.stat?.mtimeMs || 0,
	};
}

export function getCombinedYearFingerprint(
	yearItems: StorageItem[],
	metadataFingerprint: unknown,
) {
	return JSON.stringify({
		media: getYearFingerprint(yearItems),
		metadata: metadataFingerprint,
	});
}

export function serializeMetadataFingerprint(metadataFingerprint: unknown) {
	return JSON.stringify(metadataFingerprint);
}

export function normalizeMetadataPayload(
	metadata?: Partial<SessionMetadata> | null,
): SessionMetadata {
	return {
		items: metadata?.items || [],
		tags: metadata?.tags || {},
		durations: metadata?.durations || {},
		summaries: metadata?.summaries || {},
		transcriptions: metadata?.transcriptions || {},
	};
}
