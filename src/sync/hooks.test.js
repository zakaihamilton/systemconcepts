import { render } from "@testing-library/react";
import { usePageVisibility } from "@util/browser/hooks";
import { useOnline } from "@util/browser/online";
import Cookies from "js-cookie";
import { useSync } from "./hooks";
import { requestSync } from "./requests";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

jest.mock("js-cookie", () => ({ get: jest.fn() }));
jest.mock("@util/browser/hooks", () => ({ usePageVisibility: jest.fn() }));
jest.mock("@util/browser/online", () => ({ useOnline: jest.fn() }));
jest.mock("./requests", () => ({
	requestSync: jest.fn(),
	stopSync: jest.fn(),
}));
jest.mock("./autoSync", () => ({
	AUTO_SYNC_INTERVAL_MS: 12 * 60 * 1000,
	getAutoSyncJitter: jest.fn(() => 0),
	shouldRunInitialAutoSync: jest.fn(() => false),
}));
jest.mock("./syncState", () => {
	const state = { busy: false, autoSync: true, counter: 0, lastSyncTime: 0 };
	return {
		SyncActiveStore: {
			getRawState: jest.fn(() => state),
			useState: jest.fn((selector) => selector(state)),
			subscribe: jest.fn(() => jest.fn()),
		},
		UpdateSessionsStore: { getRawState: jest.fn(() => ({ busy: false })) },
	};
});

function Scheduler() {
	useSync({ schedule: true });
	return null;
}

describe("useSync automatic scheduler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Cookies.get.mockImplementation((name) => (name === "id" ? "user" : "hash"));
		useOnline.mockReturnValue(true);
		usePageVisibility.mockReturnValue(true);
		SyncActiveStore.getRawState.mockReturnValue({
			busy: false,
			autoSync: true,
			counter: 0,
			lastSyncTime: 0,
		});
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ busy: false, autoSync: true, counter: 0, lastSyncTime: 0 }),
		);
		UpdateSessionsStore.getRawState.mockReturnValue({ busy: false });
	});

	it("syncs immediately on mount when the previous sync is due", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		render(<Scheduler />);
		expect(requestSync).toHaveBeenCalledWith(false);
	});

	it("does not sync on mount when the previous sync is recent", () => {
		jest.spyOn(Date, "now").mockReturnValue(1_000);
		SyncActiveStore.getRawState.mockReturnValue({ lastSyncTime: 1 });
		render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
	});

	it("checks immediately when the page returns to visible", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		usePageVisibility.mockReturnValue(false);
		const view = render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
		usePageVisibility.mockReturnValue(true);
		view.rerender(<Scheduler />);
		expect(requestSync).toHaveBeenCalledWith(false);
	});

	it("does not sync while sessions are refreshing", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		UpdateSessionsStore.getRawState.mockReturnValue({ busy: true });
		render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
	});

	it("does not sync when automatic sync is disabled", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ busy: false, autoSync: false, counter: 0, lastSyncTime: 0 }),
		);
		render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
	});

	it("does not sync while another sync is active", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		SyncActiveStore.useState.mockImplementation((selector) =>
			selector({ busy: true, autoSync: true, counter: 0, lastSyncTime: 0 }),
		);
		render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
	});

	it("does not sync while offline or signed out", () => {
		jest.spyOn(Date, "now").mockReturnValue(12 * 60 * 1000);
		useOnline.mockReturnValue(false);
		const view = render(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
		useOnline.mockReturnValue(true);
		Cookies.get.mockReturnValue(undefined);
		view.rerender(<Scheduler />);
		expect(requestSync).not.toHaveBeenCalled();
	});
});
