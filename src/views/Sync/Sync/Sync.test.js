import { SyncContext } from "@components/Sync";
import { resetLocalCacheForFullSync, useSyncFeature } from "@sync/sync";
import { SyncActiveStore } from "@sync/syncState";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { logger } from "@util/api/logger";
import { useOnline } from "@util/browser/online";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Sync from "./Sync.js";

jest.mock("@util/domain/translations");
jest.mock("@sync/sync", () => ({
	useSyncFeature: jest.fn(),
	resetLocalCacheForFullSync: jest.fn(),
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
	useDateFormatter: jest.fn().mockReturnValue({
		format: jest.fn((date) => String(date.getTime?.() || date)),
	}),
}));
jest.mock("@util/data/string", () => ({
	formatDuration: jest.fn(() => "00:01"),
}));
jest.mock("@util/data/path", () => ({
	fileTitle: jest.fn((p) => p.replace(/\.json\.gz$/, "")),
	makePath: jest.fn((p) => p),
}));
jest.mock("@util/browser/styles", () => ({
	useStyles: jest.fn(() => "animated"),
}));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue({}),
		getRawState: jest.fn().mockReturnValue({ debugLevel: "info" }),
		subscribe: jest.fn().mockReturnValue(() => {}),
		update: jest.fn(),
	},
}));
jest.mock("@components/Sync", () => ({
	SyncContext: require("react").createContext(null),
}));
jest.mock("@widgets/Dialog", () => ({ title, onClose, actions, children }) => (
	<div data-testid="full-sync-dialog">
		<span>{title}</span>
		{children}
		{actions}
		<button type="button" onClick={onClose}>
			dialog-close
		</button>
	</div>
));
jest.mock("@ui/IconButton", () => ({ children, onClick, className }) => (
	<button
		type="button"
		data-testid="icon-button"
		className={className}
		onClick={onClick}
	>
		{children}
	</button>
));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-title={title}>{children}</div>
));
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));

describe("Sync View", () => {
	const mockTranslations = {
		SYNC: "Sync",
		LAST_SYNCED: "Last Synced",
		DURATION: "Duration",
		SYNC_STATUS: "Sync Status",
		NEVER: "Never",
		IDLE: "Idle",
		SYNCING: "Syncing",
		COMPLETE: "Complete",
		FULL_SYNC: "Full Sync",
		FULL_SYNC_MESSAGE: "Are you sure?",
		CANCEL: "Cancel",
		COPY_LOG: "Copy log",
		LOG_COPIED: "Copied",
		LOG_LEVEL: "Log Level",
		STOP: "Stop",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
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
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "u";
			if (key === "hash") return "h";
			if (key === "role") return "admin";
			return null;
		});
		Object.assign(navigator, {
			clipboard: { writeText: jest.fn() },
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("renders sync view header", () => {
		render(<Sync />);
		expect(screen.getByText("Last Synced")).toBeInTheDocument();
		expect(screen.getByText("Never")).toBeInTheDocument();
		expect(screen.getAllByText("Idle").length).toBeGreaterThan(0);
	});

	it("shows syncing status when busy and stops", () => {
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

		render(<Sync />);
		expect(screen.getAllByText(/Syncing/).length).toBeGreaterThan(0);
		expect(screen.getByText("50%")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(stop).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(1000);
	});

	it("shows complete when lastSynced set", () => {
		useSyncFeature.mockReturnValue({
			sync: jest.fn(),
			stop: jest.fn(),
			busy: false,
			lastSynced: Date.now(),
			percentage: 100,
			duration: 5000,
			currentBundle: null,
			logs: [],
			startTime: null,
		});
		render(<Sync />);
		expect(screen.getByText("Complete")).toBeInTheDocument();
	});

	it("opens full sync dialog and runs full sync", async () => {
		const sync = jest.fn().mockResolvedValue(undefined);
		resetLocalCacheForFullSync.mockResolvedValue(undefined);
		useSyncFeature.mockReturnValue({
			sync,
			stop: jest.fn(),
			busy: false,
			lastSynced: null,
			percentage: 0,
			duration: 0,
			currentBundle: null,
			logs: [],
			startTime: null,
		});
		render(<Sync />);
		fireEvent.click(screen.getAllByRole("button", { name: "Full Sync" })[0]);
		expect(screen.getByTestId("full-sync-dialog")).toBeInTheDocument();
		fireEvent.click(
			within(screen.getByTestId("full-sync-dialog")).getByRole("button", {
				name: "Full Sync",
			}),
		);
		await waitFor(() => expect(resetLocalCacheForFullSync).toHaveBeenCalled());
		await waitFor(() => expect(sync).toHaveBeenCalled());
	});

	it("copies logs to clipboard", () => {
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
				{ id: "1", timestamp: Date.now(), type: "info", message: "Hello log" },
			],
		});
		render(<Sync />);
		expect(screen.getByText("Hello log")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("icon-button"));
		expect(navigator.clipboard.writeText).toHaveBeenCalled();
		jest.advanceTimersByTime(2000);
	});

	it("changes debug level for admin", () => {
		render(<Sync />);
		const select = screen.getByLabelText("Log Level");
		fireEvent.change(select, { target: { value: "verbose" } });
		expect(SyncActiveStore.update).toHaveBeenCalled();
	});

	it("renders incomplete-sync safety log without marking complete", () => {
		Cookies.get.mockReturnValue(null);
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

	it("closes the full sync dialog via cancel and dialog close", () => {
		render(<Sync />);
		fireEvent.click(screen.getAllByRole("button", { name: "Full Sync" })[0]);
		expect(screen.getByTestId("full-sync-dialog")).toBeInTheDocument();
		fireEvent.click(
			within(screen.getByTestId("full-sync-dialog")).getByRole("button", {
				name: "Cancel",
			}),
		);
		expect(screen.queryByTestId("full-sync-dialog")).not.toBeInTheDocument();

		fireEvent.click(screen.getAllByRole("button", { name: "Full Sync" })[0]);
		fireEvent.click(screen.getByText("dialog-close"));
		expect(screen.queryByTestId("full-sync-dialog")).not.toBeInTheDocument();
	});

	it("logs when full sync fails", async () => {
		resetLocalCacheForFullSync.mockRejectedValue(new Error("cache fail"));
		render(<Sync />);
		fireEvent.click(screen.getAllByRole("button", { name: "Full Sync" })[0]);
		fireEvent.click(
			within(screen.getByTestId("full-sync-dialog")).getByRole("button", {
				name: "Full Sync",
			}),
		);
		await waitFor(() => {
			expect(logger.error).toHaveBeenCalledWith(
				"Failed to full sync",
				expect.any(Error),
			);
		});
	});

	it("shows empty log placeholder when there are no logs", () => {
		render(<Sync />);
		expect(
			screen.getByText(/Waiting for synchronization milestones/),
		).toBeInTheDocument();
	});

	it("does not copy when logs are empty", () => {
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
		render(<Sync />);
		fireEvent.click(screen.getByTestId("icon-button"));
		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
	});

	it("hides admin debug controls for non-admin users", () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "u";
			if (key === "hash") return "h";
			return null;
		});
		render(<Sync />);
		expect(screen.queryByLabelText("Log Level")).not.toBeInTheDocument();
	});

	it("syncs debug level from a custom SyncContext store", () => {
		const customStore = {
			getRawState: jest.fn().mockReturnValue({ debugLevel: "info" }),
			subscribe: jest.fn((selector, listener) => {
				listener("verbose");
				return () => {};
			}),
			update: jest.fn(),
		};
		render(
			<SyncContext.Provider value={customStore}>
				<Sync />
			</SyncContext.Provider>,
		);
		expect(screen.getByLabelText("Log Level")).toHaveValue("verbose");
		fireEvent.change(screen.getByLabelText("Log Level"), {
			target: { value: "info" },
		});
		expect(customStore.update).toHaveBeenCalled();
	});

	it("disables full sync while session updates are busy", () => {
		const { useUpdateSessions } = require("@util/domain/updateSessions");
		useUpdateSessions.mockReturnValue({ busy: true });
		render(<Sync />);
		expect(
			screen.getAllByRole("button", { name: "Full Sync" })[0],
		).toBeDisabled();
	});
});
