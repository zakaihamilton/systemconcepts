import { act, render, waitFor } from "@testing-library/react";
import { useGroups } from "@util/domain/groups";
import { compactLegacySessionThumbnails } from "@util/domain/sessionCompaction";
import storage from "@util/storage/storage";
import { SessionsStore, useSessions } from "../sessions";

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
	...jest.requireActual("@util/browser/store"),
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

let latestValue: any;

function Harness({ depends = [], options = {} }) {
	latestValue = useSessions(depends, options);
	return null;
}

function renderHarness(props: any = {}) {
	return render(<Harness {...props} />);
}

function getSessionsState() {
	return latestValue;
}

const GROUP_METADATA = [{ name: "american", color: "#fff" }];

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

describe("useSessions filtering and toolbar", () => {
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
		asMock(useGroups).mockReturnValue([GROUP_METADATA, false, jest.fn()]);
		asMock(compactLegacySessionThumbnails).mockResolvedValue(undefined);
		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockResolvedValue("");
		asMock(storage.getListing).mockResolvedValue([]);
		asMock(storage.getRecursiveList).mockResolvedValue([]);
	});

	describe("filtering", () => {
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
				expect(items.map((i: any) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters by year", async () => {
			SessionsStore.update((s) => {
				s.yearFilter = ["2023"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters by media type", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["image"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s3"]);
			});
		});

		it("excludes image-only sessions when exclude_image_only is set", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["exclude_image_only"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s1", "s2"]);
			});
		});

		it("filters sessions with a thumbnail", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_thumbnail"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id).sort()).toEqual(["s1", "s3"]);
			});
		});

		it("filters sessions without a thumbnail", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_thumbnail"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters sessions with/without a summary", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_summary"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions with/without tags", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_tags"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions with/without a saved position", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_position"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions by language (Hebrew vs English)", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_hebrew"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s2"]);
			});
		});

		it("filters sessions with/without duration", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_duration"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s1"]);
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
				expect(items.map((i: any) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions without tags", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_tags"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions with a saved position", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_position"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id)).toEqual(["s1"]);
			});
		});

		it("filters sessions without duration", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["without_duration"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id).sort()).toEqual(["s2", "s3"]);
			});
		});

		it("filters sessions with English language only", async () => {
			SessionsStore.update((s) => {
				s.typeFilter = ["with_english"];
			});
			renderHarness();
			await waitFor(() => {
				const [items] = getSessionsState();
				expect(items.map((i: any) => i.id).sort()).toEqual(["s1", "s3"]);
			});
		});
	});

	describe("toolbar and UI interactions", () => {
		it("registers a filter toolbar item that toggles the filter dialog", async () => {
			const { useToolbar } = require("@components/Toolbar");
			renderHarness();
			await waitFor(() => expect(useToolbar).toHaveBeenCalled());
			const toolbarArgs = asMock(useToolbar).mock.calls.at(-1)[0];
			expect(toolbarArgs.id).toBe("Sessions");
			const filterItem = toolbarArgs.items.find(
				(item: any) => item.id === "filter",
			);
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
			asMock(storage.exists).mockImplementation(
				async (path: any) => path === "/local/sync/groups.json",
			);
			asMock(storage.readFile).mockImplementation(async (path: any) => {
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
			const toolbarArgs = asMock(useToolbar).mock.calls.at(-1)[0];
			const groupsItems = toolbarArgs.depends[1];
			const americanItem = groupsItems.find(
				(item: any) => item.id === "american",
			);
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
});
