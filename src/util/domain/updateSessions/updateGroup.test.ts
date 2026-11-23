import "./updateGroupTestSetup";
import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import { file, setupUpdateGroupTest } from "./updateGroupTestSetup";
import { getListing, updateYearSync } from "./utils";

describe("updateGroupProcess", () => {
	beforeEach(() => {
		setupUpdateGroupTest();
	});

	it("combines Wasabi media with DigitalOcean metadata and prefers Wasabi images", async () => {
		await updateGroupProcess("test", true);

		expect(fetchSessionMetadata).toHaveBeenCalledTimes(1);
		expect(fetchSessionMetadata).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
			expect.any(Boolean),
		);
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = asMock(updateYearSync).mock.calls[0];
		expect(year).toBe("2024");
		expect(sessions).toHaveLength(1);

		const [session] = sessions;
		expect(session.id).toBe("2024-05-05 Test Session");
		expect(session.video.path).toBe(
			"wasabi/test/2024/2024-05-05 Test Session.mp4",
		);
		expect(session.image.path).toBe(
			"wasabi/test/2024/2024-05-05 Test Session.jpg",
		);
		expect(session.duration).toBe(123);
		expect(session.summaryText).toBe("Summary from DigitalOcean");
		expect(session.transcription).toBe(true);
		expect(session.transcriptPath).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
		);
		expect(session.subtitles.path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
		);
		expect(session.thumbnail).toBe(true);
	});

	it("aborts when the group listing fails", async () => {
		asMock(getListing).mockRejectedValue(new Error("listing down"));

		await expect(updateGroupProcess("test", true)).resolves.toBeUndefined();
		expect(updateYearSync).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
	});

	it("resolves metadata by normalized session name when id key is missing", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-05-05 Grace Session`;
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
						`${sessionId}.mp4`,
						`wasabi/test/${currentYear}/${sessionId}.mp4`,
					),
				];
			}
			return [];
		});
		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockResolvedValue("");
		asMock(updateYearSync).mockResolvedValue({
			sessions: [
				{
					id: sessionId,
					name: sessionId,
					group: "test",
					year: currentYear,
					tags: ["Grace"],
				},
			],
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("resolves metadata by exact session id and session name keys", async () => {
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
						"2024-05-06 Name Key Session.mp4",
						"wasabi/test/2024/2024-05-06 Name Key Session.mp4",
					),
				];
			}
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {
				"2024-05-05 Test Session": ["by-id"],
				"Name Key Session": ["by-name"],
			},
			durations: {
				"2024-05-05 Test Session": 11,
				"Name Key Session": 22,
			},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		const byId = sessions.find((s: any) => s.id === "2024-05-05 Test Session");
		const byName = sessions.find(
			(s: any) => s.id === "2024-05-06 Name Key Session",
		);
		expect(byId.tags).toEqual(["by-id"]);
		expect(byId.duration).toBe(11);
		expect(byName.tags).toEqual(["by-name"]);
		expect(byName.duration).toBe(22);
	});

	it("processes digital-ocean-only image sessions without wasabi media", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [];
			}
			if (path === "/aws/sessions/test/2024") {
				return [
					file(
						"2024-05-07 Orphan Cover.png",
						"/aws/sessions/test/2024/2024-05-07 Orphan Cover.png",
					),
				];
			}
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [
				file(
					"2024-05-07 Orphan Cover.png",
					"/aws/sessions/test/2024/2024-05-07 Orphan Cover.png",
				),
			],
			tags: { "2024-05-07 Orphan Cover": ["do-only"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).toBe("2024-05-07 Orphan Cover");
		expect(sessions[0].image).toBeTruthy();
		expect(sessions[0].tags).toEqual(["do-only"]);
	});

	it("recognizes year folders listed with stat.type instead of type", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [
					{
						name: "2024",
						path: "wasabi/test/2024",
						stat: { type: "dir" },
					},
				];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
				];
			}
			return [];
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
			expect.anything(),
		);
	});

	it("records added sessions with metadata flags when updateYearSync reports changes", async () => {
		const newSession = {
			id: "2024-05-05 Test Session",
			name: "Test Session",
			group: "test",
			year: "2024",
			tags: ["fresh"],
			duration: 120,
			summaryText: "Updated summary",
			transcription: true,
			thumbnail: true,
			files: [{ name: "2024-05-05 Test Session.mp4" }],
		};
		asMock(updateYearSync).mockResolvedValue({
			counter: 1,
			newCount: 1,
			newSessions: [newSession],
		});

		await updateGroupProcess("test", true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.addedCount).toBe(1);
		expect(status.newSessions[0].metadata).toEqual({
			hasTags: true,
			hasDuration: true,
			hasSummary: true,
			hasTranscription: true,
			hasThumbnail: true,
		});
		expect(SyncActiveStore.getRawState().needsSessionReload).toBe(true);
	});

	it("continues when group metadata listing returns null", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "/aws/sessions/test") {
				return null;
			}
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
			return [];
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("records year processing errors that lack a message property", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				throw { toString: () => "year failure without message" };
			}
			return [];
		});

		await expect(
			updateGroupProcess("test", true, false, false, true),
		).resolves.toBeUndefined();

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.errors).toEqual(
			expect.arrayContaining(["year failure without message"]),
		);
	});

	it("aborts split updates when the root listing throws without a message", async () => {
		asMock(getListing).mockImplementation(async () => {
			throw { toString: () => "listing failure without message" };
		});

		await expect(updateGroupProcess("test", true)).resolves.toBeUndefined();

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.errors).toEqual(
			expect.arrayContaining(["listing failure without message"]),
		);
	});

	it("finishes with completion logs when split updates add sessions", async () => {
		asMock(updateYearSync).mockResolvedValue({
			counter: 2,
			newCount: 2,
			newSessions: [
				{ id: "2024-05-05 Test Session", files: [] },
				{ id: "2024-05-06 Metadata Only", files: [] },
			],
		});

		await updateGroupProcess("test", true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.progress).toBe(1);
		expect(status.year).toBeNull();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringMatching(/Updated \(1 sessions, 2 updated, last:/),
			"success",
		);
	});
});
