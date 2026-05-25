import { useToolbar } from "@components/Toolbar";
import { useSyncFeature } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import Sync from "./index.js";

jest.mock("@sync/sync");
jest.mock("@util/translations");
jest.mock("@components/Toolbar");
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
});
