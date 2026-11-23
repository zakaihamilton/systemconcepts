import "./updateGroupTestSetup";
import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { addSyncLog } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { getCombinedYearFingerprint } from "./fingerprints";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import {
	emptyYearMetadata,
	file,
	mockYearListing,
	setupUpdateGroupTest,
} from "./updateGroupTestSetup";
import { getListing, updateYearSync } from "./utils";

function setupUnchangedYearCache(
	sessionTitle: string,
	location: "year" | "bundle",
) {
	const currentYear = String(new Date().getFullYear());
	const sessionId = `${currentYear}-03-03 ${sessionTitle}`;
	const yearItems = [
		file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
	];
	const metadataFingerprint = [null, null, null, null];
	const yearFingerprint = getCombinedYearFingerprint(
		yearItems,
		metadataFingerprint,
	);
	const localSessionsPath =
		location === "bundle"
			? "/local/sync/test.json"
			: `/local/sync/test/${currentYear}.json`;
	const isLocalSessionsPath = (path: string) =>
		location === "bundle"
			? path.endsWith("/local/sync/test.json")
			: path === localSessionsPath;

	mockYearListing(currentYear, yearItems);
	asMock(storage.exists).mockImplementation(async (path: string) =>
		isLocalSessionsPath(path),
	);
	asMock(storage.readFile).mockImplementation(async (path: string) => {
		if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
			return JSON.stringify({
				fingerprint: yearFingerprint,
				metadataFingerprint: JSON.stringify(metadataFingerprint),
				metadata: emptyYearMetadata(),
			});
		}
		if (isLocalSessionsPath(path)) {
			return JSON.stringify({
				sessions: [
					{
						id: sessionId,
						name: sessionId,
						group: "test",
						year: currentYear,
					},
				],
			});
		}
		return "";
	});
}

describe("updateGroupProcess caching, incremental refresh, and targeted sync", () => {
	beforeEach(() => {
		setupUpdateGroupTest();
	});

	it("uses cached metadata for non-forced updates without calling the aggregated endpoint", async () => {
		const currentYear = String(new Date().getFullYear());
		mockYearListing(currentYear, [
			file(
				`${currentYear}-05-05 Cached Session.mp4`,
				`wasabi/test/${currentYear}/${currentYear}-05-05 Cached Session.mp4`,
			),
		]);
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(".group-update-cache")) {
				return "";
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: `${currentYear}-05-05 Cached Session`,
							name: `${currentYear}-05-05 Cached Session`,
							group: "test",
							tags: ["cached"],
							duration: 321,
							summaryText: "Cached summary",
							transcription: true,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(loadTags).not.toHaveBeenCalled();
		expect(loadDurations).not.toHaveBeenCalled();
		expect(loadSummaries).not.toHaveBeenCalled();
		expect(loadTranscriptions).not.toHaveBeenCalled();

		const [, year, sessions] = asMock(updateYearSync).mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions[0].tags).toEqual(["cached"]);
		expect(sessions[0].duration).toBe(321);
		expect(sessions[0].summaryText).toBe("Cached summary");
		expect(sessions[0].transcription).toBe(true);
	});

	it("does not skip year when fingerprint matches but local sessions miss listing media", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-07-17 Overview - Kabbalah & Suffering`;
		const newId = `${currentYear}-07-20 Overview - The Grip & Shells`;
		const yearItems = [
			file(`${existingId}.mp4`, `wasabi/test/${currentYear}/${existingId}.mp4`),
			file(`${newId}.mp4`, `wasabi/test/${currentYear}/${newId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const localYearPath = `/local/sync/test/${currentYear}.json`;

		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [
					{
						name: currentYear,
						type: "dir",
						path: `wasabi/test/${currentYear}`,
					},
				];
			}
			if (path === `wasabi/test/${currentYear}`) {
				return yearItems;
			}
			if (path === "/aws/sessions/test") {
				return [];
			}
			return [];
		});

		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: emptyYearMetadata(),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: existingId,
							name: existingId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		asMock(updateYearSync).mockResolvedValue({
			counter: 1,
			newCount: 1,
			newSessions: [{ id: newId }],
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).not.toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			expect.anything(),
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = asMock(updateYearSync).mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions.map((session: any) => session.id)).toEqual(
			expect.arrayContaining([existingId, newId]),
		);
		expect(UpdateSessionsStore.getRawState().status[0].sessionCount).toBe(0);
	});

	it("only rematerializes changed sessions when year fingerprint changes", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-07-17 Overview - Kabbalah & Suffering`;
		const newId = `${currentYear}-07-23 Conclusion`;
		const yearItems = [
			{
				id: `wasabi/test/${currentYear}/${existingId}.mp4`,
				type: "file" as const,
				name: `${existingId}.mp4`,
				path: `wasabi/test/${currentYear}/${existingId}.mp4`,
				stat: { type: "file" as const, size: 10, mtimeMs: 1 },
			},
			{
				id: `wasabi/test/${currentYear}/${newId}.mp4`,
				type: "file" as const,
				name: `${newId}.mp4`,
				path: `wasabi/test/${currentYear}/${newId}.mp4`,
				stat: { type: "file" as const, size: 20, mtimeMs: 2 },
			},
		];
		const metadataFingerprint = [null, null, null, null];
		const staleFingerprint = getCombinedYearFingerprint(
			[yearItems[0]],
			metadataFingerprint,
		);
		const localYearPath = `/local/sync/test/${currentYear}.json`;

		mockYearListing(currentYear, yearItems);
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: staleFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					sessionFingerprints: {
						[existingId]: JSON.stringify([
							{
								name: `${existingId}.mp4`,
								type: "file",
								size: 10,
								mtimeMs: 1,
							},
						]),
					},
					metadata: emptyYearMetadata(),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: existingId,
							name: existingId,
							group: "test",
							year: currentYear,
							files: [`${existingId}.mp4`],
							tags: ["keep"],
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		asMock(updateYearSync).mockResolvedValue({
			counter: 1,
			newCount: 1,
			newSessions: [{ id: newId }],
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions.map((session: any) => session.id).sort()).toEqual(
			[existingId, newId].sort(),
		);
		const kept = sessions.find((session: any) => session.id === existingId);
		expect(kept.tags).toEqual(["keep"]);
	});

	it("skips remote metadata fetch when year cache metadata fingerprint is unchanged", async () => {
		const metadataFiles = [
			{ name: "2024.tags", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", size: 100, mtimeMs: 1 },
			{ name: "2024.md", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", size: 100, mtimeMs: 1 },
		];
		const metadataFingerprint = [
			{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.md", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", type: "", size: 100, mtimeMs: 1 },
		];

		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
					file(
						"2024-05-06 New Session.mp4",
						"wasabi/test/2024/2024-05-06 New Session.mp4",
					),
				];
			}
			if (path === "/aws/sessions/test") {
				return metadataFiles;
			}
			return [];
		});

		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "stale-combined-fingerprint",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [
							file(
								"2024-05-05 Test Session.png",
								"/aws/sessions/test/2024/2024-05-05 Test Session.png",
							),
						],
						tags: { "2024-05-05 Test Session": ["cached-tag"] },
						durations: { "2024-05-05 Test Session": 999 },
						summaries: { "2024-05-05 Test Session": "Cached summary" },
						transcriptions: { "2024-05-05 Test Session": true },
					},
				});
			}
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["cached-tag"]);
		expect(sessions[0].duration).toBe(999);
		expect(sessions[0].summaryText).toBe("Cached summary");
	});

	it("fetches remote metadata on forceUpdate when metadata fingerprint is unchanged", async () => {
		const metadataFingerprint = [
			{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.md", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", type: "", size: 100, mtimeMs: 1 },
		];

		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
				];
			}
			if (path === "/aws/sessions/test") {
				return [
					{ name: "2024.tags", size: 100, mtimeMs: 1 },
					{ name: "2024.duration", size: 100, mtimeMs: 1 },
					{ name: "2024.md", size: 100, mtimeMs: 1 },
					{ name: "2024.zip", size: 100, mtimeMs: 1 },
				];
			}
			return [];
		});

		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "stale-combined-fingerprint",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [],
						tags: { "2024-05-05 Test Session": ["forced-cache"] },
						durations: { "2024-05-05 Test Session": 555 },
						summaries: {},
						transcriptions: {},
					},
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValueOnce({
			items: [],
			tags: { "2024-05-05 Test Session": ["fresh"] },
			durations: { "2024-05-05 Test Session": 123 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, true);

		expect(fetchSessionMetadata).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
			true,
		);
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["fresh"]);
		expect(sessions[0].duration).toBe(123);
	});

	it("fetches remote metadata when metadata fingerprint changes", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
				];
			}
			if (path === "/aws/sessions/test") {
				return [{ name: "2024.tags", size: 200, mtimeMs: 2 }];
			}
			return [];
		});

		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "old",
					metadataFingerprint: JSON.stringify([
						{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
					]),
					metadata: {
						items: [],
						tags: { "2024-05-05 Test Session": ["stale"] },
						durations: {},
						summaries: {},
						transcriptions: {},
					},
				});
			}
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(fetchSessionMetadata).toHaveBeenCalledTimes(1);
	});

	it("skips an unchanged year when fingerprint and sessions match", async () => {
		setupUnchangedYearCache("Unchanged Session", "year");

		await updateGroupProcess("test", false, false);

		expect(updateYearSync).not.toHaveBeenCalled();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
	});

	it("warns when year cache read fails and continues with remote metadata", async () => {
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				throw new Error("cache read fail");
			}
			if (path.endsWith(".duration")) return "123";
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read year cache"),
			expect.any(Error),
		);
		expect(updateYearSync).toHaveBeenCalled();
	});

	it("warns when year cache write fails after processing", async () => {
		jest.useFakeTimers();
		asMock(storage.writeFile).mockRejectedValue(new Error("cache write fail"));

		const updatePromise = updateGroupProcess("test", true, false);
		await updatePromise;
		await jest.advanceTimersByTimeAsync(1000);
		await Promise.resolve();

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to write year cache"),
			expect.any(Error),
		);
		jest.useRealTimers();
	});

	it("reuses cached merged sessions when an unchanged year is skipped", async () => {
		setupUnchangedYearCache("Cached Merged", "bundle");

		asMock(getFileInfo).mockResolvedValue({ hash: "abc", size: 10 });

		await updateGroupProcess("test", false, false, true, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("ignores non-session and metadata-only listing entries when checking for missing sessions", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-05-05 Cached Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const yearItems = [
			file("notes.txt", `wasabi/test/${currentYear}/notes.txt`),
			file(
				`${currentYear}-05-06 Metadata Only.txt`,
				`wasabi/test/${currentYear}/${currentYear}-05-06 Metadata Only.txt`,
			),
			file(
				`${currentYear}-05-07 .mp4`,
				`wasabi/test/${currentYear}/${currentYear}-05-07 .mp4`,
			),
			file(`${sessionId}.txt`, `wasabi/test/${currentYear}/${sessionId}.txt`),
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);

		mockYearListing(currentYear, yearItems);
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: emptyYearMetadata(),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: sessionId,
							name: sessionId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(updateYearSync).not.toHaveBeenCalled();
	});

	it("treats cached year files with non-array sessions as empty", async () => {
		const currentYear = String(new Date().getFullYear());
		const localYearPath = `/local/sync/test/${currentYear}.json`;

		mockYearListing(currentYear, [
			file(
				`${currentYear}-08-02 Fresh Session.mp4`,
				`wasabi/test/${currentYear}/${currentYear}-08-02 Fresh Session.mp4`,
			),
		]);
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath) {
				return JSON.stringify({ sessions: "not-an-array" });
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("detects missing sessions from uncached audio files in the listing", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-01-01 Existing Session`;
		const newAudioId = `${currentYear}-08-03 Audio Only Session`;
		const yearItems = [
			file(`${existingId}.mp4`, `wasabi/test/${currentYear}/${existingId}.mp4`),
			file(`${newAudioId}.m4a`, `wasabi/test/${currentYear}/${newAudioId}.m4a`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const localYearPath = `/local/sync/test/${currentYear}.json`;

		mockYearListing(currentYear, yearItems);
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: emptyYearMetadata(),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: existingId,
							name: existingId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		expect(updateYearSync).toHaveBeenCalled();
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions.map((session: any) => session.id)).toEqual(
			expect.arrayContaining([existingId, newAudioId]),
		);
	});
});
