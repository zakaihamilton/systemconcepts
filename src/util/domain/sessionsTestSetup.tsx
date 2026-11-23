import { render } from "@testing-library/react";

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

const GROUP_METADATA = [{ name: "american", color: "#fff" }];

export function sessionFixture(
	id: string,
	name: string,
	date: string,
	group: string,
	year: string,
	type: string,
) {
	return { id, name, date, group, year, type };
}

export function mockSessionsStorageFiles(
	storage: typeof import("@util/storage/storage").default,
	existingPaths: string[],
	fileContents: Record<string, string>,
) {
	asMock(storage.exists).mockImplementation(async (path: string) =>
		existingPaths.includes(path),
	);
	asMock(storage.readFile).mockImplementation(
		async (path: string) => fileContents[path] ?? "",
	);
}

export function createSessionsTestHarness(
	useSessions: typeof import("./sessions").useSessions,
	SessionsStore: typeof import("./sessions").SessionsStore,
	useGroups: typeof import("@util/domain/groups").useGroups,
	compactLegacySessionThumbnails: typeof import("@util/domain/sessionCompaction").compactLegacySessionThumbnails,
	storage: typeof import("@util/storage/storage").default,
) {
	let latestValue: any;

	type HarnessProps = {
		depends?: Parameters<typeof useSessions>[0];
		options?: Parameters<typeof useSessions>[1];
	};

	function Harness({ depends = [], options = {} }: HarnessProps) {
		latestValue = useSessions(depends, options);
		return null;
	}

	function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
		return render(<Harness {...props} />);
	}

	function getSessionsState() {
		return latestValue;
	}

	function resetSessionsTestState() {
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
	}

	return {
		GROUP_METADATA,
		getSessionsState,
		renderHarness,
		resetSessionsTestState,
	};
}
