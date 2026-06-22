import {
	getCombinedYearFingerprint,
	getYearFingerprint,
	normalizeMetadataPayload,
} from "./fingerprints";

describe("session update fingerprints", () => {
	it("sorts stable file metadata by name", () => {
		expect(
			getYearFingerprint([
				{ id: "b", name: "b.mp3", type: "file", size: 2 },
				{ id: "a", name: "a.mp3", type: "file", size: 1 },
			]),
		).toEqual([
			{ name: "a.mp3", type: "file", size: 1, mtimeMs: 0 },
			{ name: "b.mp3", type: "file", size: 2, mtimeMs: 0 },
		]);
	});

	it("produces a deterministic combined fingerprint", () => {
		const files = [{ id: "a", name: "a.mp3", type: "file" as const }];
		expect(getCombinedYearFingerprint(files, ["metadata"])).toBe(
			getCombinedYearFingerprint(files, ["metadata"]),
		);
	});

	it("normalizes malformed or incomplete metadata", () => {
		expect(normalizeMetadataPayload(null)).toEqual({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
	});
});
