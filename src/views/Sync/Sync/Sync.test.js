import { useSyncFeature } from "@sync/sync";
import { fireEvent, render, screen } from "@testing-library/react";
import { useOnline } from "@util/browser/online";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Sync from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@sync/sync", () => ({
	useSyncFeature: jest.fn(),
	clearBundleCache: jest.fn(),
}));
jest.mock("@util/browser/online");
jest.mock("js-cookie");
jest.mock("@util/domain/updateSessions", () => ({
	useUpdateSessions: jest.fn().mockReturnValue({ busy: false }),
}));
jest.mock("@util/domain/groups", () => ({
	useGroups: jest.fn().mockReturnValue([[]]),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest
		.fn()
		.mockReturnValue({ format: jest.fn((date) => date.toString()) }),
}));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue({}),
		getRawState: jest.fn().mockReturnValue({}),
		subscribe: jest.fn().mockReturnValue(() => {}),
		update: jest.fn(),
	},
}));

describe("Sync View", () => {
	const mockTranslations = {
		SYNC: "Sync",
		LAST_SYNCED: "Last Synced",
		DURATION: "Duration",
		SYNC_STATUS: "Sync Status",
		NEVER: "Never",
		IDLE: "Idle",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		useOnline.mockReturnValue(true);
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			stop: jest.fn(),
			busy: false,
			lastSynced: null,
			percentage: 0,
			duration: 0,
			currentBundle: null,
			logs: [],
			startTime: null,
		});
		Cookies.get.mockReturnValue(null);
	});

	it("renders sync view header", () => {
		render(<Sync />);
		expect(screen.getByText("Last Synced")).toBeInTheDocument();
		expect(screen.getByText("Never")).toBeInTheDocument();
		expect(screen.getAllByText("Idle").length).toBeGreaterThan(0);
	});

	it("shows syncing status when busy", () => {
		const stop = jest.fn();
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			stop,
			busy: true,
			lastSynced: null,
			percentage: 50,
			duration: 100,
			currentBundle: "test.json.gz",
			logs: [],
			startTime: Date.now() - 1000,
		});
		useTranslations.mockReturnValue({
			...mockTranslations,
			SYNCING: "Syncing",
		});

		render(<Sync />);
		expect(screen.getAllByText(/Syncing/).length).toBeGreaterThan(0);
		expect(screen.getByText("50%")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("renders an incomplete-sync safety log without marking the view as complete", () => {
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			stop: jest.fn(),
			busy: false,
			lastSynced: null,
			percentage: 0,
			duration: 0,
			currentBundle: null,
			startTime: null,
			logs: [
				{
					id: "blocked-delete",
					timestamp: Date.now(),
					type: "warning",
					message: "Deletion blocked for Main: sync phase is incomplete",
				},
			],
		});

		render(<Sync />);

		expect(
			screen.getByText("Deletion blocked for Main: sync phase is incomplete"),
		).toBeInTheDocument();
		expect(screen.getAllByText("Idle").length).toBeGreaterThan(0);
	});
});
