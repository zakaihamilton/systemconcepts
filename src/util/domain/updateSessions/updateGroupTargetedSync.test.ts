import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
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
import { file } from "./updateGroupTestSetup";
import { getListing, updateYearSync } from "./utils";

jest.mock("@util/storage/storage", () =>
	require("./updateGroupMockFactories").storageMockFactory(),
);

describe("updateGroupProcess targeted and recent-days sync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		UpdateSessionsStore.update((s) => {
			s.status = [];
		});
		SyncActiveStore.update((s) => {
			s.needsSessionReload = false;
		});

		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
			return "";
		});
		asMock(loadTags).mockResolvedValue({});
		asMock(loadDurations).mockResolvedValue({});
		asMock(loadSummaries).mockResolvedValue({});
		asMock(loadTranscriptions).mockResolvedValue({});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		asMock(getListing).mockResolvedValue([]);
		asMock(updateYearSync).mockResolvedValue({
			counter: 0,
			newCount: 0,
			newSessions: [],
		});
	});

	it("updates only recent sessions while preserving cached sessions from the same year", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const oldSession = {
			id: `${currentYear}-01-01 Historical Session`,
			name: `${currentYear}-01-01 Historical Session`,
			group: "test",
			year: currentYear,
			tags: ["preserve"],
		};
		const recentId = `${recentDate} Recent Session`;
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
				return [
					file(
						`${oldSession.id}.mp4`,
						`wasabi/test/${currentYear}/${oldSession.id}.mp4`,
					),
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath)
				return JSON.stringify({ sessions: [oldSession] });
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [recentId]: ["recent"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, null, 30);

		const [, year, sessions] = asMock(updateYearSync).mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: oldSession.id, tags: ["preserve"] }),
				expect.objectContaining({ id: recentId, tags: ["recent"] }),
			]),
		);
		expect(sessions).toHaveLength(2);
	});

	it("logs a targeted sync and refreshes the matching session", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepId = `${currentYear}-01-01 Keep Session`;
		const targetId = `${currentYear}-02-02 Target Session`;
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
				return [
					file(`${keepId}.mp4`, `wasabi/test/${currentYear}/${keepId}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: keepId,
							name: keepId,
							group: "test",
							year: currentYear,
							tags: ["keep"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh"], [keepId]: ["keep"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess(
			"test",
			false,
			false,
			false,
			false,
			targetId,
			null,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining(
				`Targeted sync requested for session: ${targetId}`,
			),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining(
				`Force re-fetching metadata for targeted session: ${targetId}`,
			),
			"info",
		);
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions.map((s: any) => s.id).sort()).toEqual(
			[keepId, targetId].sort(),
		);
		expect(sessions.find((s: any) => s.id === keepId).tags).toEqual(["keep"]);
	});

	it("logs a full-year refresh when recentDays is set without local cache", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const recentId = `${recentDate} Recent Session`;

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
				return [
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockResolvedValue(false);
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [recentId]: ["recent"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, null, 30);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("No local year cache; refreshing the full year"),
			"info",
		);
	});

	it("merges recent session updates using name-only cached session keys", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const oldId = `${currentYear}-01-01 Historical Session`;
		const recentId = `${recentDate} Recent Session`;
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
				return [
					file(`${oldId}.mp4`, `wasabi/test/${currentYear}/${oldId}.mp4`),
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							name: oldId,
							group: "test",
							year: currentYear,
							tags: ["preserve"],
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [recentId]: ["recent"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, null, 30);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: oldId, tags: ["preserve"] }),
				expect.objectContaining({ id: recentId, tags: ["recent"] }),
			]),
		);
	});

	it("logs resolved metadata details for targeted sessions with summaries", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepId = `${currentYear}-01-01 Keep Session`;
		const targetId = `${currentYear}-02-02 Target Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const longSummary = "A".repeat(120);

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
				return [
					file(`${keepId}.mp4`, `wasabi/test/${currentYear}/${keepId}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: keepId,
							name: keepId,
							group: "test",
							year: currentYear,
							tags: ["keep"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh"] },
			durations: { [targetId]: 321 },
			summaries: { [targetId]: longSummary },
			transcriptions: { [targetId]: true },
		});

		await updateGroupProcess("test", false, true, false, false, targetId, null);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Resolved summary from S3"),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Targeted session metadata updated successfully"),
			"success",
		);
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions.find((session: any) => session.id === keepId).tags).toEqual(
			["keep"],
		);
		expect(
			sessions.find((session: any) => session.id === targetId).summaryText,
		).toBe(longSummary);
	});

	it("uses cached bundled sessions matched by explicit year field", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-03-03 Year Field Session`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const cachedSession = {
			id: sessionId,
			name: sessionId,
			group: "test",
			year: currentYear,
			tags: ["year-field"],
		};

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
			return [];
		});
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [],
						tags: {},
						durations: {},
						summaries: {},
						transcriptions: {},
					},
				});
			}
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [cachedSession] });
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
	});

	it("skips unchanged bundled years using sessions keyed by name only", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-04-04 Name Only Session`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);

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
			return [];
		});
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [],
						tags: {},
						durations: {},
						summaries: {},
						transcriptions: {},
					},
				});
			}
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({
					sessions: [
						{
							name: sessionId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
	});

	it("returns cached non-target sessions by name during targeted sync", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepName = `${currentYear}-05-05 Keep By Name`;
		const targetId = `${currentYear}-05-06 Target Session`;
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
				return [
					file(`${keepName}.mp4`, `wasabi/test/${currentYear}/${keepName}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							name: keepName,
							group: "test",
							year: currentYear,
							tags: ["cached-by-name"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh-target"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, targetId, null);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(
			sessions.find((session: any) => session.name === keepName).tags,
		).toEqual(["cached-by-name"]);
		expect(
			sessions.find((session: any) => session.id === targetId).tags,
		).toEqual(["fresh-target"]);
	});
});
