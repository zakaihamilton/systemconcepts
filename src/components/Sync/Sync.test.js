import { useToolbar } from "@components/Toolbar";
import { useSyncFeature } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { setPath } from "@util/domain/views";
import Sync from "./index.js";

jest.mock("@sync/sync");
jest.mock("@util/domain/translations");
jest.mock("@components/Toolbar");
jest.mock("@util/domain/views", () => ({ setPath: jest.fn() }));
jest.mock("@sync/syncState", () => ({
	UpdateSessionsStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
	SyncActiveStore: {
		useState: jest.fn(),
	},
}));

describe("Sync Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ SYNC: "Sync", SYNCING: "Syncing..." });
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			busy: false,
			error: null,
			duration: 0,
			changed: false,
			percentage: 0,
			phase: "idle",
		});
		UpdateSessionsStore.useState.mockReturnValue({ busy: false });
		SyncActiveStore.useState.mockReturnValue({
			personalSyncBusy: false,
			personalSyncError: null,
		});
	});

	it("renders children within provider", () => {
		const { getByText } = render(
			<Sync>
				<div>Test Child</div>
			</Sync>,
		);
		expect(getByText("Test Child")).toBeInTheDocument();
	});

	it("registers toolbar item", () => {
		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);
		expect(useToolbar).toHaveBeenCalled();
		const toolbarArgs = useToolbar.mock.calls[0][0];
		expect(toolbarArgs.id).toBe("Sync");
	});

	it("shows syncing label when busy", () => {
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			busy: true,
			error: null,
			duration: 0,
			changed: false,
			percentage: 50,
			phase: "main",
		});
		useTranslations.mockReturnValue({ SYNCING_MAIN: "Syncing Main" });

		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);
		const toolbarArgs = useToolbar.mock.calls[0][0];
		const name = toolbarArgs.items[0].ariaLabel;
		expect(name).toContain("Syncing Main");
		expect(name).toContain("50%");
	});

	it("opens the sync view when the toolbar item is clicked during a sync", () => {
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			busy: true,
			duration: 0,
			percentage: 10,
			phase: "main",
		});

		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);
		useToolbar.mock.calls[0][0].items[0].onClick();

		expect(setPath).toHaveBeenCalledWith("sync");
	});

	it("opens the session update dialog while sessions are busy", () => {
		UpdateSessionsStore.useState.mockReturnValue({ busy: true });

		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);
		useToolbar.mock.calls[0][0].items[0].onClick();

		expect(UpdateSessionsStore.update).toHaveBeenCalled();
		const update = UpdateSessionsStore.update.mock.calls[0][0];
		const state = {};
		update(state);
		expect(state.showUpdateDialog).toBe(true);
	});

	it("starts a sync when the toolbar item is idle", () => {
		const sync = jest.fn();
		useSyncFeature.mockReturnValue({
			sync,
			busy: false,
			duration: 0,
			percentage: 0,
		});

		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);
		useToolbar.mock.calls[0][0].items[0].onClick();

		expect(sync).toHaveBeenCalledTimes(1);
	});

	it("reports a failed sync through the toolbar label", () => {
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			busy: false,
			error: new Error("incomplete"),
			duration: 0,
			percentage: 0,
		});
		useTranslations.mockReturnValue({
			SYNC: "Sync",
			SYNC_FAILED: "Sync failed",
		});

		render(
			<Sync>
				<div>Test</div>
			</Sync>,
		);

		expect(useToolbar.mock.calls[0][0].items[0].ariaLabel).toBe("Sync failed");
	});
});
