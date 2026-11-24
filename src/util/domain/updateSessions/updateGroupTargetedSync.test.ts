import "./updateGroupTestSetup";
import { addSyncLog } from "@sync/sync";
import storage from "@util/storage/storage";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import {
	cachedYearSession,
	emptyYearMetadata,
	file,
	mockRecentYearCache,
	mockUnchangedYearCache,
	mockYearCacheAndSessions,
	mockYearListing,
	recentSessionId,
	setupUpdateGroupTest,
	yearListingFiles,
	yearMetadata,
} from "./updateGroupTestSetup";
import { updateYearSync } from "./utils";

describe("updateGroupProcess targeted and recent-days sync", () => {
	beforeEach(() => {
		setupUpdateGroupTest({
			sessionMetadata: emptyYearMetadata(),
			listing: async () => [],
		});
	});

	it("updates only recent sessions while preserving cached sessions from the same year", async () => {
		const currentYear = String(new Date().getFullYear());
		const oldSession = cachedYearSession(
			`${currentYear}-01-01 Historical Session`,
			currentYear,
			{ tags: ["preserve"] },
		);
		const recentId = mockRecentYearCache(currentYear, oldSession.id, [
			oldSession,
		]);

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

		mockYearListing(
			currentYear,
			yearListingFiles(currentYear, [`${keepId}.mp4`, `${targetId}.mp4`]),
		);
		mockYearCacheAndSessions(currentYear, [
			cachedYearSession(keepId, currentYear, { tags: ["keep"] }),
			cachedYearSession(targetId, currentYear, { tags: ["stale"] }),
		]);

		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { [targetId]: ["fresh"], [keepId]: ["keep"] },
			}),
		);

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
		const recentId = recentSessionId();

		mockYearListing(currentYear, [
			file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
		]);
		asMock(storage.exists).mockResolvedValue(false);
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({ tags: { [recentId]: ["recent"] } }),
		);

		await updateGroupProcess("test", false, true, false, false, null, 30);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("No local year cache; refreshing the full year"),
			"info",
		);
	});

	it("merges recent session updates using name-only cached session keys", async () => {
		const currentYear = String(new Date().getFullYear());
		const oldId = `${currentYear}-01-01 Historical Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const recentId = mockRecentYearCache(
			currentYear,
			oldId,
			[
				{
					name: oldId,
					group: "test",
					year: currentYear,
					tags: ["preserve"],
				},
			],
			{ localPath: localYearPath },
		);

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

		mockYearListing(
			currentYear,
			yearListingFiles(currentYear, [`${keepId}.mp4`, `${targetId}.mp4`]),
		);
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
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { [targetId]: ["fresh"] },
				durations: { [targetId]: 321 },
				summaries: { [targetId]: longSummary },
				transcriptions: { [targetId]: true },
			}),
		);

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
		const yearItems = yearListingFiles(currentYear, [`${sessionId}.mp4`]);
		mockUnchangedYearCache(
			currentYear,
			yearItems,
			[
				cachedYearSession(sessionId, currentYear, {
					tags: ["year-field"],
				}),
			],
			{ localPath: "/local/sync/bundle.json" },
		);

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
		const yearItems = yearListingFiles(currentYear, [`${sessionId}.mp4`]);
		mockUnchangedYearCache(
			currentYear,
			yearItems,
			[
				{
					name: sessionId,
					group: "test",
					year: currentYear,
				},
			],
			{ localPath: "/local/sync/bundle.json" },
		);

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

		mockYearListing(currentYear, [
			file(`${keepName}.mp4`, `wasabi/test/${currentYear}/${keepName}.mp4`),
			file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
		]);
		mockYearCacheAndSessions(currentYear, [
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
		]);

		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { [targetId]: ["fresh-target"] },
			}),
		);

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
