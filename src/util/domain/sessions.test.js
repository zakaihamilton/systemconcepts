import { act, render, waitFor } from "@testing-library/react";
import { useGroups } from "@util/domain/groups";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import storage from "@util/storage/storage";
import { SessionsStore, useSessions } from "./sessions";

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));

jest.mock("@sync/sync", () => ({
	useSync: jest.fn(() => [0]),
}));

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));

jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(() => "desktop"),
}));

jest.mock("@util/domain/groups", () => {
	const { Store } = require("pullstate");
	return {
		GroupsStore: new Store({ settings: {} }),
		useGroups: jest.fn(),
	};
});

jest.mock("@util/domain/sessionCompaction", () => ({
	compactLegacySessionThumbnails: jest.fn(),
}));

jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(() => ({ FILTER: "Filter" })),
}));

jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	getListing: jest.fn(),
	getRecursiveList: jest.fn(),
	readFile: jest.fn(),
}));

function file(path, name) {
	return { path, name: name || path.split("/").pop(), type: "file" };
}

let latestValue;

function Harness({ depends = [], options = {} }) {
	latestValue = useSessions(depends, options);
	return null;
}

function renderHarness(props) {
	return render(<Harness {...props} />);
}

function getSessionsState() {
	return latestValue;
}

const GROUP_METADATA = [{ name: "american", color: "#fff" }];

describe("useSessions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		latestValue = null;
		SessionsStore.update((s) => {
			s.sessions = null;
			s.groups = [];
			s.groupFilter = [];
			s.typeFilter = [];
			s.yearFilter = [];
			s.busy = false;
			s.counter = 0;
			s.syncCounter = 0;
			s.groupsHash = "";
			s.showFilterDialog = false;
			s.filterBarManuallyEnabled = false;
		});
		useGroups.mockReturnValue([GROUP_METADATA, false, jest.fn()]);
		compactLegacySessionThumbnails.mockResolvedValue();
		storage.exists.mockResolvedValue(false);
		storage.readFile.mockResolvedValue("");
		storage.getListing.mockResolvedValue([]);
		storage.getRecursiveList.mockResolvedValue([]);
	});

	it("loads sessions for a non-bundled group using year files found via the manifest", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-05-05 Test Session",
							name: "2024-05-05 Test Session",
							date: "2024-05-05",
							group: "american",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		const [items] = getSessionsState();
		expect(items[0].id).toBe("2024-05-05 Test Session");
		expect(items[0].group).toBe("american");
	});

	it("loads a merged group from its single json file", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/american.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/american.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-01-01 Merged Session",
							name: "2024-01-01 Merged Session",
							date: "2024-01-01",
							group: "american",
							year: "2024",
							type: "video",
						},
					],
				});
			}
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		expect(getSessionsState()[0][0].id).toBe("2024-01-01 Merged Session");
	});

	it("loads bundled sessions from bundle.json and skips per-year fetching", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" || path === "/local/sync/bundle.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({
					groups: [{ name: "bundledgroup", bundled: true }],
				});
			}
			if (path === "/local/sync/bundle.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-02-02 Bundled Session",
							name: "2024-02-02 Bundled Session",
							date: "2024-02-02",
							group: "bundledgroup",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		expect(getSessionsState()[0][0].group).toBe("bundledgroup");
		expect(storage.getListing).not.toHaveBeenCalled();
	});

	it("falls back to storage.getListing for year files when no manifest exists", async () => {
		storage.exists.mockImplementation(async (path) => {
			return path === "/local/sync/groups.json";
		});
		storage.getListing.mockImplementation(async (path) => {
			if (path === "/local/sync/american") {
				return [{ name: "2024.json" }];
			}
			return [];
		});
		storage.readFile.mockImplementation(async (path) => {
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
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/american/2024.json"
			);
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		expect(getSessionsState()[0][0].id).toBe("2024-03-03 Listing Session");
	});

	it("merges personal metadata (position/duration) for split group sessions", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json" ||
				path === "local/personal"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-05-05 Test Session",
							name: "Test Session",
							date: "2024-05-05",
							group: "american",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path === "local/personal/american/2024.json") {
				return JSON.stringify({
					"2024-05-05 Test Session": { position: 42, duration: 99 },
				});
			}
			return "";
		});
		storage.getRecursiveList.mockResolvedValue([
			file("local/personal/american/2024.json", "2024.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
		});

		expect(getSessionsState()[0][0].position).toBe(42);
	});

	it("recovers gracefully when a personal metadata file fails to parse", async () => {
		storage.exists.mockImplementation(async (path) => {
			return path === "/local/sync/groups.json" || path === "local/personal";
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [] });
			}
			if (path === "local/personal/broken.json") {
				return "not json";
			}
			return "";
		});
		storage.getRecursiveList.mockResolvedValue([
			file("local/personal/broken.json", "broken.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
	});

	it("continues loading when legacy thumbnail compaction fails", async () => {
		compactLegacySessionThumbnails.mockRejectedValue(
			new Error("compaction failed"),
		);
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/groups.json",
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [] });
			}
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Legacy thumbnail compaction failed"),
			expect.any(Error),
		);
	});

	it("sets sessions to an empty array and logs when loading throws unexpectedly", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") return true;
			throw new Error("boom");
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return "not valid json{{{";
			}
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalled();
	});

	it("returns an empty groups array when groups.json does not exist", async () => {
		storage.exists.mockResolvedValue(false);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const [, , groupMetadata] = getSessionsState();
		expect(groupMetadata).toEqual(GROUP_METADATA);
	});

	it("does not reload while a load is already in progress (busy guard)", async () => {
		let resolveExists;
		storage.exists.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveExists = resolve;
				}),
		);

		renderHarness();

		await waitFor(() => {
			expect(SessionsStore.getRawState().busy).toBe(true);
		});

		resolveExists(false);
	});

	describe("filtering", () => {
		const SESSIONS = [
			{
				id: "s1",
				group: "american",
				year: "2024",
				type: "video",
				thumbnail: "img1.jpg",
				summary: { path: "s1.md" },
				tags: ["tag1"],
				position: 10,
				hasDuration: true,
				isHebrew: false,
			},
			{
				id: "s2",
				group: "hebrew",
				year: "2023",
				type: "audio",
				thumbnail: null,
				summary: null,
				tags: [],
				position: 0,
				hasDuration: false,
				isHebrew: true,
			},
			{
				id: "s3",
				group: "american",
				year: "2024",
				type: "image",
				thumbnail: "img3.jpg",
				summary: null,
				tags: [],
				position: 0,
				hasDuration: false,
				isHebrew: false,
			},
		];

		beforeEach(() => {
			SessionsStore.update((s) => {
				s.sessions = SESSIONS;
			});
		});

		it("filters by group", async () => {
			SessionsStore.update((s) => {
				s.groupFilter = ["hebrew"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters by year", async () => {
			SessionsStore.update((s) => {
				s.yearFilter = ["2023"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters by media type", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["image"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s3"]);
			});
		});

		it("excludes image-only sessions when exclude_image_only is set", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["exclude_image_only"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s1", "s2"]);
			});
		});

		it("filters sessions with a thumbnail", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_thumbnail"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s1", "s3"]);
			});
		});

		it("filters sessions without a thumbnail", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_thumbnail"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters sessions with/without a summary", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_summary"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions with/without tags", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_tags"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions with/without a saved position", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_position"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions by language (Hebrew vs English)", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_hebrew"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters sessions with/without duration", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_duration"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s1"]);
			});
		});

		it("returns unfiltered sessions when filterSessions option is false", async () => {
			SessionsStore.update((s) => {
				s.groupFilter = ["hebrew"];
			});
			renderHarness({ options: { filterSessions: false } });
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items).toHaveLength(3);
			});
		});

		it("filters sessions without a summary", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_summary"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions without tags", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_tags"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions with a saved position", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_position"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions without duration", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_duration"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions with English language only", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_english"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i) => i.id).sort()).toEqual(["s1", "s3"]);
			});
		});
	});

	describe("toolbar and UI interactions", () => {
		it("registers a filter toolbar item that toggles the filter dialog", async () => {
			const { useToolbar } = require("@components/Toolbar");
			renderHarness();
			await waitFor(() => expect(useToolbar).toHaveBeenCalled());
			const toolbarArgs = useToolbar.mock.calls.at(-1)[0];
			expect(toolbarArgs.id).toBe("Sessions");
			const filterItem = toolbarArgs.items.find((item) => item.id === "filter");
			expect(filterItem).toBeDefined();

			await act(async () => {
				filterItem.onClick();
			});

			expect(SessionsStore.getRawState().showFilterDialog).toBe(true);
			expect(SessionsStore.getRawState().filterBarManuallyEnabled).toBe(true);
		});

		it("hides the filter dialog automatically once filters are cleared and it was not manually enabled", async () => {
			SessionsStore.update((s) => {
				s.showFilterDialog = true;
				s.filterBarManuallyEnabled = false;
				s.groupFilter = [];
				s.typeFilter = [];
				s.yearFilter = [];
			});
			renderHarness();
			await waitFor(() => {
				expect(SessionsStore.getRawState().showFilterDialog).toBe(false);
			});
		});

		it("builds groupsItems with click handlers that toggle the group filter", async () => {
			storage.exists.mockImplementation(
				async (path) => path === "/local/sync/groups.json",
			);
			storage.readFile.mockImplementation(async (path) => {
				if (path === "/local/sync/groups.json") {
					return JSON.stringify({
						groups: [{ name: "american" }, { name: "hebrew" }],
					});
				}
				return "";
			});
			renderHarness();

			await waitFor(() => {
				expect(SessionsStore.getRawState().groups).toHaveLength(2);
			});
			const { useToolbar } = require("@components/Toolbar");
			await waitFor(() => expect(useToolbar).toHaveBeenCalled());
			const toolbarArgs = useToolbar.mock.calls.at(-1)[0];
			const groupsItems = toolbarArgs.depends[1];
			const americanItem = groupsItems.find((item) => item.id === "american");
			expect(americanItem).toBeDefined();
			SessionsStore.update((s) => {
				s.groupFilter = ["american"];
			});
			await act(async () => {
				americanItem.onClick();
			});
			expect(SessionsStore.getRawState().groupFilter).toEqual([]);
			await act(async () => {
				americanItem.onClick();
			});
			expect(SessionsStore.getRawState().groupFilter).toEqual(["american"]);
		});
	});

	it("skips a second load while the first update is still busy", async () => {
		let resolveGroupsExists;
		let blocked = true;
		storage.exists.mockImplementation(async (path) => {
			if (blocked && path === "/local/sync/groups.json") {
				return new Promise((resolve) => {
					resolveGroupsExists = () => resolve(true);
				});
			}
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [] });
			}
			return "";
		});

		renderHarness();
		await waitFor(() => expect(SessionsStore.getRawState().busy).toBe(true));

		const { logger } = require("@util/api/logger");
		const loadingLogs = () =>
			logger.debug.mock.calls.filter((call) =>
				String(call[0]).includes("Loading sessions"),
			).length;
		const beforeCounter = loadingLogs();
		SessionsStore.update((s) => {
			s.counter = 1;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(loadingLogs()).toBe(beforeCounter);

		blocked = false;
		resolveGroupsExists();
		await waitFor(() => expect(SessionsStore.getRawState().busy).toBe(false));
	});

	it("logs when bundle.json cannot be parsed", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" || path === "/local/sync/bundle.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({
					groups: [{ name: "bundledgroup", bundled: true }],
				});
			}
			if (path === "/local/sync/bundle.json") return "{bad";
			return "";
		});

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error reading bundle.json"),
			expect.any(Error),
		);
	});

	it("loads personal metadata from merged group files and bundle.json", async () => {
		useGroups.mockReturnValue([
			[
				{ name: "american", color: "#fff", merged: true },
				{ name: "bundledgroup", bundled: true },
			],
			false,
			jest.fn(),
		]);
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/american.json" ||
				path === "/local/sync/bundle.json" ||
				path === "local/personal"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({
					groups: [
						{ name: "american" },
						{ name: "bundledgroup", bundled: true },
					],
				});
			}
			if (path === "/local/sync/american.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-01-01 Merged Session",
							name: "Merged Session",
							date: "2024-01-01",
							group: "american",
							year: "2024",
							type: "video",
						},
					],
				});
			}
			if (path === "/local/sync/bundle.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-02-02 Bundled Session",
							name: "Bundled Session",
							date: "2024-02-02",
							group: "bundledgroup",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path === "local/personal/american.json") {
				return JSON.stringify({
					"2024/2024-01-01 Merged Session.json": {
						position: 11,
						duration: 22,
					},
				});
			}
			if (path === "local/personal/bundle.json") {
				return JSON.stringify({
					"bundledgroup/2024/2024-02-02 Bundled Session.json": {
						position: 33,
						duration: 44,
					},
				});
			}
			return "";
		});
		storage.getRecursiveList.mockResolvedValue([
			file("local/personal/american.json", "american.json"),
			file("local/personal/bundle.json", "bundle.json"),
			file("local/personal/unknown/deep/nested.json", "nested.json"),
		]);

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(2);
		});
		const [items] = getSessionsState();
		const merged = items.find((item) => item.group === "american");
		const bundled = items.find((item) => item.group === "bundledgroup");
		expect(merged.position).toBe(11);
		expect(bundled.position).toBe(33);
	});

	it("logs when personal metadata listing fails", async () => {
		storage.exists.mockImplementation(async (path) => {
			return path === "/local/sync/groups.json" || path === "local/personal";
		});
		storage.readFile.mockResolvedValue(
			JSON.stringify({ groups: [{ name: "american" }] }),
		);
		storage.getRecursiveList.mockRejectedValue(new Error("personal list fail"));

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error loading personal metadata"),
			expect.any(Error),
		);
	});

	it("reloads when the manual counter changes", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/groups.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({ groups: [{ name: "american" }] }),
		);

		renderHarness();
		await waitFor(() => expect(getSessionsState()[0]).toEqual([]));

		storage.readFile.mockResolvedValue(
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
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
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

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
	});

	it("logs and continues when a year file read throws", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
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

		renderHarness();

		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toEqual([]);
		});
		const { logger } = require("@util/api/logger");
		expect(logger.error).toHaveBeenCalled();
	});

	it("loads many groups in chunks without throwing", async () => {
		jest.useFakeTimers();
		const groups = Array.from({ length: 5 }, (_, index) => ({
			name: `group${index}`,
		}));
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				groups.some((group) => path === `/local/sync/${group.name}/2024.json`)
			);
		});
		storage.readFile.mockImplementation(async (path) => {
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

	it("skips personal metadata files with unknown directory structures", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/groups.json" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/american/2024.json" ||
				path === "local/personal"
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/groups.json") {
				return JSON.stringify({ groups: [{ name: "american" }] });
			}
			if (path === "/local/sync/files.json") {
				return JSON.stringify([{ path: "/american/2024.json" }]);
			}
			if (path === "/local/sync/american/2024.json") {
				return JSON.stringify({
					sessions: [
						{
							id: "2024-01-01 Session",
							name: "Session",
							date: "2024-01-01",
							group: "american",
							year: "2024",
							type: "audio",
						},
					],
				});
			}
			if (path.includes("weird/extra/deep.json")) {
				return JSON.stringify({ "2024/session": { position: 5 } });
			}
			return "";
		});
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "file",
				name: "deep.json",
				path: "local/personal/weird/extra/deep.json",
			},
		]);

		renderHarness();
		await waitFor(() => {
			const [items] = getSessionsState();
			expect(items).toHaveLength(1);
			expect(items[0].name).toBe("Session");
		});
	});
});
