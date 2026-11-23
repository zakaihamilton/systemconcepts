import "./sessionsTestSetup";
import { waitFor } from "@testing-library/react";
import { useGroups } from "@util/domain/groups";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import storage from "@util/storage/storage";
import { SessionsStore, useSessions } from "./sessions";
import {
	createSessionsTestHarness,
	mockSessionsStorageFiles,
	renderAndWaitForSessionCount,
	sessionFixture,
} from "./sessionsTestSetup";

const {
	GROUP_METADATA,
	getSessionsState,
	renderHarness,
	resetSessionsTestState,
} = createSessionsTestHarness(
	useSessions,
	SessionsStore,
	useGroups,
	compactLegacySessionThumbnails,
	storage,
);

describe("useSessions", () => {
	beforeEach(resetSessionsTestState);

	it("loads sessions for a non-bundled group using year files found via the manifest", async () => {
		mockSessionsStorageFiles(
			storage,
			[
				"/local/sync/groups.json",
				"/local/sync/files.json",
				"/local/sync/american/2024.json",
			],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "american" }],
				}),
				"/local/sync/files.json": JSON.stringify([
					{ path: "/american/2024.json" },
				]),
				"/local/sync/american/2024.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-05-05 Test Session",
							"2024-05-05 Test Session",
							"2024-05-05",
							"american",
							"2024",
							"audio",
						),
					],
				}),
			},
		);

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 1);

		const [items] = getSessionsState();
		expect(items[0].id).toBe("2024-05-05 Test Session");
		expect(items[0].group).toBe("american");
	});

	it("loads a merged group from its single json file", async () => {
		mockSessionsStorageFiles(
			storage,
			["/local/sync/groups.json", "/local/sync/american.json"],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "american" }],
				}),
				"/local/sync/american.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-01-01 Merged Session",
							"2024-01-01 Merged Session",
							"2024-01-01",
							"american",
							"2024",
							"video",
						),
					],
				}),
			},
		);

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 1);

		expect(getSessionsState()[0][0].id).toBe("2024-01-01 Merged Session");
	});

	it("loads bundled sessions from bundle.json and skips per-year fetching", async () => {
		mockSessionsStorageFiles(
			storage,
			["/local/sync/groups.json", "/local/sync/bundle.json"],
			{
				"/local/sync/groups.json": JSON.stringify({
					groups: [{ name: "bundledgroup", bundled: true }],
				}),
				"/local/sync/bundle.json": JSON.stringify({
					sessions: [
						sessionFixture(
							"2024-02-02 Bundled Session",
							"2024-02-02 Bundled Session",
							"2024-02-02",
							"bundledgroup",
							"2024",
							"audio",
						),
					],
				}),
			},
		);

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 1);

		expect(getSessionsState()[0][0].group).toBe("bundledgroup");
		expect(storage.getListing).not.toHaveBeenCalled();
	});

	it("falls back to storage.getListing for year files when no manifest exists", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		asMock(storage.getListing).mockImplementation(async (path: any) => {
			if (path === "/local/sync/american") {
				return [{ name: "2024.json" }];
			}
			return [];
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-03-03 Listing Session",
							name: "2024-03-03 Listing Session",
							date: "2024-03-03",
							group: "american",
							year: "2024",
							type: "image",
						},
					],
				});
			}
			return "";
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 1);

		expect(getSessionsState()[0][0].id).toBe("2024-03-03 Listing Session");
	});

	it("continues loading when legacy thumbnail compaction fails", async () => {
		asMock(compactLegacySessionThumbnails).mockRejectedValue(
			new Error("compaction failed"),
		);
		mockSessionsStorageFiles(storage, ["/local/sync/groups.json"], {
			"/local/sync/groups.json": JSON.stringify({ groups: [] }),
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
		const { logger } = require("@util/api/logger");
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Legacy thumbnail compaction failed"),
			expect.any(Error),
		);
	});

	it("sets sessions to an empty array and logs when loading throws unexpectedly", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") return true;
			throw new Error("boom");
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return "not valid json{{{";
			}
			return "";
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalled();
	});

	it("returns an empty groups array when groups.json does not exist", async () => {
		asMock(storage.exists).mockResolvedValue(false);

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
		const [, , groupMetadata] = getSessionsState();
		expect(groupMetadata).toEqual(GROUP_METADATA);
	});

	it("does not reload while a load is already in progress (busy guard)", async () => {
		let resolveExists: (val: boolean) => void;
		asMock(storage.exists).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveExists = resolve;
				}),
		);

		renderHarness();

		await waitFor(() => {
			expect(SessionsStore.getRawState().busy).toBe(true);
		});

		resolveExists!(false);
	});

	it("skips a second load while the first update is still busy", async () => {
		let resolveGroupsExists: () => void;
		let blocked = true;
		asMock(storage.exists).mockImplementation(async (path: any) => {
			if (blocked && path === "/local/sync/groups.json") {
				return new Promise((resolve) => {
					resolveGroupsExists = () => resolve(true);
				});
			}
			return false;
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [] });
			}
			return "";
		});

		renderHarness();
		await waitFor(() => expect(SessionsStore.getRawState().busy).toBe(true));

		const { logger } = require("@util/api/logger");
		const loadingLogs = () =>
			asMock(logger.debug).mock.calls.filter((call: any) =>
				String(call[0]).includes("Loading sessions"),
			).length;
		const beforeCounter = loadingLogs();
		SessionsStore.update((s) => {
			s.counter = 1;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(loadingLogs()).toBe(beforeCounter);

		blocked = false;
		resolveGroupsExists!();
		await waitFor(() => expect(SessionsStore.getRawState().busy).toBe(false));
	});

	it("logs when bundle.json cannot be parsed", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" || path === "/local/sync/bundle.json"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({
					groups: [{ name: "bundledgroup", bundled: true }],
				});
			}
			if (path === "/local/sync/bundle.json") return "{bad";
			return "";
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error reading bundle.json"),
			expect.any(Error),
		);
	});

	it("reloads when the manual counter changes", async () => {
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === "/local/sync/groups.json",
		);
		asMock(storage.readFile).mockResolvedValue(
			JSON.stringify({ groups: [{ name: "american" }] }),
		);

		renderHarness();
		await waitFor(() => expect(getSessionsState()[0]).toEqual([]));

		asMock(storage.readFile).mockResolvedValue(
			JSON.stringify({
				groups: [{ name: "american" }],
			}),
		);
		SessionsStore.update((s) => {
			s.counter = 1;
		});

		await waitFor(() => expect(storage.readFile).toHaveBeenCalled());
	});

	it("returns empty results when a year file is missing sessions", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({ version: 1 });
			}
			return "";
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
	});

	it("logs and continues when a year file read throws", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				throw new Error("year read fail");
			}
			return "";
		});

		await renderAndWaitForSessionCount(renderHarness, getSessionsState, 0);
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalled();
	});

	it("loads many groups in chunks without throwing", async () => {
		jest.useFakeTimers();
		const groups = Array.from({ length: 5 }, (_, index) => ({
			name: `group${index}`,
		}));
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				groups.some((group) => path === `/local/sync/${group.name}/2024.json`)
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify(
					groups.map((group) => ({ path: `/${group.name}/2024.json` })),
				);
			}
			const match = path.match(/\/local\/sync\/(group\d+)\/2024\.json$/);
			if (match) {
				return JSON.stringify({
					sessions: [
						{
							id: `2024-01-0${match[1].replace("group", "")} Chunk Session`,
							name: "Chunk Session",
							date: "2024-01-01",
							group: match[1],
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			return "";
		});

		renderHarness();
		await jest.runAllTimersAsync();
		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(5);
		});
		jest.useRealTimers();
	});
});
