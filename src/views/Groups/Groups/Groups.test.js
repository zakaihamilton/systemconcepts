import { useToolbar } from "@components/Toolbar";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { logger } from "@util/api/logger";
import { useOnline } from "@util/browser/online";
import { useDeviceType } from "@util/browser/styles";
import { GroupsStore } from "@util/domain/groups";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useUpdateSessions } from "@util/domain/updateSessions";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import Groups from "./index.js";

jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions");
jest.mock("@util/domain/groups", () => ({
	GroupsStore: {
		useState: jest.fn().mockReturnValue({ counter: 1, showDisabled: false }),
		update: jest.fn((updater) => {
			const state = { counter: 1, showDisabled: false };
			updater(state);
			return state;
		}),
	},
}));
jest.mock("@util/domain/updateSessions");
jest.mock("@util/browser/online");
jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
	useStyles: jest.fn().mockReturnValue({}),
}));
jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		exists: jest.fn(),
		readFile: jest.fn(),
		getListing: jest.fn(),
	},
	exists: jest.fn(),
	readFile: jest.fn(),
	getListing: jest.fn(),
}));
jest.mock("@widgets/Table", () => (props) => (
	<div
		data-testid="table"
		data-columns={props.columns.map((column) => column?.id)}
		data-list-class={props.viewModes.list.className}
		data-loading={String(!!props.loading)}
	>
		{props.data?.map((row) => {
			const mapped = props.mapper ? props.mapper(row) : row;
			return (
				<div key={row.name} data-testid={`row-${row.name}`}>
					{mapped.nameWidget || row.name}
					{mapped.progress}
					{mapped.colorWidget}
					<span data-testid={`storage-${row.name}`}>{mapped.storageSize}</span>
					<span data-testid={`storage-mode-${row.name}`}>
						{mapped.storageMode}
					</span>
					<span data-testid={`session-count-${row.name}`}>
						{mapped.sessionCount}
					</span>
				</div>
			);
		})}
		<button
			type="button"
			data-testid="refresh"
			onClick={() => props.refresh?.()}
		>
			refresh
		</button>
	</div>
));
jest.mock("@widgets/Label", () => ({ name }) => (
	<div data-testid="label">{name}</div>
));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("../ItemMenu", () => () => <div data-testid="item-menu" />);
jest.mock("../ColorPicker", () => ({ onChangeComplete, name }) => (
	<button
		type="button"
		data-testid={`color-picker-${name}`}
		onClick={() => onChangeComplete?.({ hex: "#aabbcc" })}
	>
		pick
	</button>
));
jest.mock("../ProgressDialog", () => () => (
	<div data-testid="progress-dialog" />
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("js-cookie", () => ({
	get: jest.fn().mockReturnValue("test"),
}));

describe("Groups View", () => {
	let toolbarItems = [];

	beforeEach(() => {
		jest.clearAllMocks();
		toolbarItems = [];
		useToolbar.mockImplementation(({ items }) => {
			toolbarItems = (items || []).filter(Boolean);
		});
		useTranslations.mockReturnValue({
			NAME: "Name",
			PROGRESS: "Progress",
			STORAGE: "Storage",
			SIZE: "Size",
			SESSIONS: "Sessions",
			COLOR: "Color",
			UPDATE: "Update",
			UPDATE_ALL: "Update all",
			UPDATE_RECENT: "Update recent",
			UPDATE_METADATA: "Update metadata",
			SHOW_DISABLED: "Show disabled",
			HIDE_DISABLED: "Hide disabled",
			SHOW_DISABLED_GROUPS: "Show disabled groups",
			HIDE_DISABLED_GROUPS: "Hide disabled groups",
			BUNDLED: "Bundled",
			MERGED: "Merged",
			SPLIT: "Split",
			SYNCING: "Syncing",
			SYNC_SESSIONS: "Sync sessions",
			SYNC_ALL_SESSIONS: "Sync all sessions",
			UPDATE_RECENT_SESSIONS: "Update recent sessions",
			UPDATE_METADATA_CURRENT_YEAR: "Update metadata",
			IMPORT_GROUPS: "Import Groups",
			IMPORT: "Import",
		});
		useSessions.mockReturnValue([[], false, [], jest.fn()]);
		useUpdateSessions.mockReturnValue({
			status: [],
			busy: false,
			start: null,
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		useOnline.mockReturnValue(true);
		useDeviceType.mockReturnValue("desktop");
		GroupsStore.useState.mockReturnValue({ counter: 1, showDisabled: false });
		Cookies.get.mockReturnValue("test");
		storage.exists.mockResolvedValue(false);
	});

	it("renders groups table and progress dialog", () => {
		const { getByTestId } = render(<Groups />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("progress-dialog")).toBeInTheDocument();
	});

	it("does not show a group-list progress indicator after its update completes", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 2, count: 2 }],
			busy: false,
			start: null,
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});

		const { getByTestId } = render(<Groups />);
		await act(async () => {});
		expect(getByTestId("table").dataset.columns).not.toContain("progress");
	});

	it("shows a group-list progress indicator while a group update is unfinished", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 1, count: 2 }],
			busy: true,
			start: Date.now(),
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});

		const { getByTestId } = render(<Groups />);
		await act(async () => {});
		expect(getByTestId("table").dataset.columns).toContain("progress");
	});

	it("keeps the color swatch in its own list column", () => {
		const { getByTestId } = render(<Groups />);

		expect(getByTestId("table").dataset.listClass).toContain(
			"listItemWithColor",
		);
	});

	it("allocates a list column for both progress and color", () => {
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 1, count: 2 }],
			busy: false,
			start: Date.now(),
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});

		const { getByTestId } = render(<Groups />);

		expect(getByTestId("table").dataset.listClass).toContain(
			"listItemWithProgressAndColor",
		);
	});

	it("registers toolbar actions when signed in and online", () => {
		render(<Groups />);
		const ids = toolbarItems.map((i) => i.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"sync_sessions",
				"sync_all_sessions",
				"update_recent_sessions",
				"showDisabled",
				"import_groups",
			]),
		);
	});

	it("toggles showDisabled from toolbar", () => {
		render(<Groups />);
		const toggle = toolbarItems.find((i) => i.id === "showDisabled");
		toggle.onClick();
		expect(GroupsStore.update).toHaveBeenCalled();
	});

	it("invokes update session toolbar actions", async () => {
		const updateAllSessions = jest.fn().mockResolvedValue();
		const updateRecentSessions = jest.fn().mockResolvedValue();
		const updateAllMetadataCurrentYear = jest.fn().mockResolvedValue();
		useUpdateSessions.mockReturnValue({
			status: [],
			busy: false,
			start: null,
			updateSessions: jest.fn().mockResolvedValue(),
			updateAllSessions,
			updateAllMetadataCurrentYear,
			updateRecentSessions,
			updateGroup: jest.fn(),
		});
		render(<Groups />);
		await toolbarItems.find((i) => i.id === "sync_all_sessions")?.onClick();
		await toolbarItems
			.find((i) => i.id === "update_recent_sessions")
			?.onClick();
		expect(updateAllSessions).toHaveBeenCalled();
		expect(updateRecentSessions).toHaveBeenCalled();
	});

	it("hides sync toolbar when offline", () => {
		useOnline.mockReturnValue(false);
		render(<Groups />);
		expect(toolbarItems.every((i) => i.id !== "sync_all_sessions")).toBe(true);
	});

	it("calculates sizes for split groups", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.getListing.mockResolvedValue([{ name: "2024.json" }]);
		storage.readFile.mockResolvedValue("x".repeat(100));

		render(<Groups />);
		await act(async () => {});
		expect(storage.getListing).toHaveBeenCalled();
	});

	it("calculates sizes for merged groups", async () => {
		const group = { name: "archive", disabled: true, merged: true };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("merged-content");

		render(<Groups />);
		await act(async () => {});
		expect(storage.readFile).toHaveBeenCalled();
	});

	it("calculates sizes for bundled groups", async () => {
		const group = { name: "archive", bundled: true, disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [{ group: "archive", name: "s1" }],
			}),
		);

		render(<Groups />);
		await act(async () => {});
		expect(storage.readFile).toHaveBeenCalled();
	});

	it("uses mobile device type", () => {
		useDeviceType.mockReturnValue("phone");
		render(<Groups />);
		expect(screen.getByTestId("table")).toBeInTheDocument();
	});

	it("shows loading state from sessions", () => {
		useSessions.mockReturnValue([[], true, [], jest.fn()]);
		render(<Groups />);
		expect(screen.getByTestId("table").dataset.loading).toBe("true");
	});

	it("invokes sync sessions with showDisabled from toolbar", async () => {
		const updateSessions = jest.fn().mockResolvedValue();
		GroupsStore.useState.mockReturnValue({ counter: 1, showDisabled: true });
		useUpdateSessions.mockReturnValue({
			status: [],
			busy: false,
			start: null,
			updateSessions,
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		render(<Groups />);
		await toolbarItems.find((i) => i.id === "sync_sessions")?.onClick();
		expect(updateSessions).toHaveBeenCalledWith(true);
	});

	it("invokes update metadata for current year from toolbar", async () => {
		const updateAllMetadataCurrentYear = jest.fn().mockResolvedValue();
		useUpdateSessions.mockReturnValue({
			status: [],
			busy: false,
			start: null,
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear,
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		render(<Groups />);
		await toolbarItems
			.find((i) => i.id === "update_metadata_all_current_year")
			?.onClick();
		expect(updateAllMetadataCurrentYear).toHaveBeenCalled();
	});

	it("shows busy toolbar with syncing duration", () => {
		jest.useFakeTimers();
		const start = Date.now() - 5000;
		useUpdateSessions.mockReturnValue({
			status: [],
			busy: true,
			start,
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		render(<Groups />);
		expect(toolbarItems.find((i) => i.id === "busy")).toBeTruthy();
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		jest.useRealTimers();
	});

	it("logs bundle read errors and continues size calculation", async () => {
		const group = { name: "archive", bundled: true, disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockRejectedValue(new Error("bundle read failed"));

		render(<Groups />);
		await act(async () => {});
		expect(logger.error).toHaveBeenCalledWith(
			"Error reading bundle for size check:",
			expect.any(Error),
		);
	});

	it("logs per-group size errors and falls back to zero", async () => {
		const group = { name: "broken", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.getListing.mockRejectedValue(new Error("listing failed"));

		render(<Groups />);
		await act(async () => {});
		expect(logger.error).toHaveBeenCalledWith(
			"Error calculating size for broken:",
			expect.any(Error),
		);
	});

	it("maps session counts and row widgets for groups", async () => {
		const group = { name: "archive", disabled: false, color: "#111" };
		const setGroups = jest.fn();
		useSessions.mockReturnValue([
			[{ group: "archive" }, { group: "archive" }],
			false,
			[group],
			setGroups,
		]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 1, count: 2, index: 1 }],
			busy: false,
			start: null,
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		storage.exists.mockResolvedValue(true);
		storage.getListing.mockResolvedValue([{ name: "2024.json" }]);
		storage.readFile.mockResolvedValue("x".repeat(50));

		render(<Groups />);
		await act(async () => {});
		expect(screen.getByTestId("progress")).toBeInTheDocument();
		expect(screen.getByTestId("storage-archive")).toHaveTextContent(/\S/);

		fireEvent.click(screen.getByTestId("color-picker-archive"));
		expect(setGroups).toHaveBeenCalled();
	});

	it("imports groups from an array json file", async () => {
		const setGroups = jest.fn((updater) =>
			updater([{ name: "archive", color: "#000" }]),
		);
		useSessions.mockReturnValue([[], false, [], setGroups]);
		const { container } = render(<Groups />);

		toolbarItems.find((i) => i.id === "import_groups")?.onClick();
		const input = container.querySelector('input[type="file"]');
		const file = new File(
			[JSON.stringify([{ name: "archive", color: "#123456" }])],
			"groups.json",
			{ type: "application/json" },
		);
		Object.defineProperty(file, "text", {
			value: () =>
				Promise.resolve(
					JSON.stringify([{ name: "archive", color: "#123456" }]),
				),
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});
		expect(setGroups).toHaveBeenCalled();
	});

	it("imports groups from an object map json file", async () => {
		const setGroups = jest.fn((updater) => updater([]));
		useSessions.mockReturnValue([[], false, [], setGroups]);
		const { container } = render(<Groups />);

		const input = container.querySelector('input[type="file"]');
		const payload = { archive: { color: "#abc", disabled: true } };
		const file = new File([JSON.stringify(payload)], "groups.json", {
			type: "application/json",
		});
		Object.defineProperty(file, "text", {
			value: () => Promise.resolve(JSON.stringify(payload)),
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});
		expect(setGroups).toHaveBeenCalled();
	});

	it("imports groups from a groups wrapper object", async () => {
		const setGroups = jest.fn((updater) => updater([]));
		useSessions.mockReturnValue([[], false, [], setGroups]);
		const { container } = render(<Groups />);

		const input = container.querySelector('input[type="file"]');
		const payload = {
			groups: [{ name: "archive", merged: true, bundled: false }],
		};
		const file = new File([JSON.stringify(payload)], "groups.json", {
			type: "application/json",
		});
		Object.defineProperty(file, "text", {
			value: () => Promise.resolve(JSON.stringify(payload)),
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});
		expect(setGroups).toHaveBeenCalled();
	});

	it("alerts when group import fails", async () => {
		const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
		useSessions.mockReturnValue([[], false, [], jest.fn()]);
		const { container } = render(<Groups />);

		const input = container.querySelector('input[type="file"]');
		const file = new File(["not json"], "groups.json", {
			type: "application/json",
		});
		Object.defineProperty(file, "text", {
			value: () => Promise.resolve("not json"),
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});
		expect(alertSpy).toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(
			"Error importing groups:",
			expect.any(Error),
		);
		alertSpy.mockRestore();
	});

	it("alerts when imported file has no groups", async () => {
		const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
		useSessions.mockReturnValue([[], false, [], jest.fn()]);
		const { container } = render(<Groups />);

		const input = container.querySelector('input[type="file"]');
		const file = new File(["[]"], "groups.json", { type: "application/json" });
		Object.defineProperty(file, "text", {
			value: () => Promise.resolve("[]"),
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});
		expect(alertSpy).toHaveBeenCalledWith(
			expect.stringContaining("no groups found"),
		);
		alertSpy.mockRestore();
	});

	it("updates group color through the table mapper", async () => {
		const group = { name: "archive", disabled: false, color: "#111" };
		const setGroups = jest.fn((updater) => {
			const next = updater([group]);
			expect(next[0].color).toBe("#aabbcc");
			return next;
		});
		useSessions.mockReturnValue([[], false, [group], setGroups]);
		storage.exists.mockResolvedValue(false);

		render(<Groups />);
		await act(async () => {});
		fireEvent.click(screen.getByTestId("color-picker-archive"));
		expect(setGroups).toHaveBeenCalled();
	});

	it("increments counter when table refresh is triggered", () => {
		render(<Groups />);
		fireEvent.click(screen.getByTestId("refresh"));
		expect(GroupsStore.update).toHaveBeenCalled();
	});

	it("ignores file input changes when no file is selected", async () => {
		const setGroups = jest.fn();
		useSessions.mockReturnValue([[], false, [], setGroups]);
		const { container } = render(<Groups />);
		const input = container.querySelector('input[type="file"]');
		await act(async () => {
			fireEvent.change(input, { target: { files: [] } });
		});
		expect(setGroups).not.toHaveBeenCalled();
	});

	it("shows hide-disabled label when disabled groups are visible", () => {
		GroupsStore.useState.mockReturnValue({ counter: 1, showDisabled: true });
		render(<Groups />);
		const toggle = toolbarItems.find((i) => i.id === "showDisabled");
		expect(toggle.name).toBe("Hide disabled groups");
	});

	it("hides sync toolbar when cookies are missing", () => {
		Cookies.get.mockReturnValue(null);
		render(<Groups />);
		expect(toolbarItems.every((i) => i.id !== "sync_sessions")).toBe(true);
	});

	it("skips bundled size when bundle has no sessions for the group", async () => {
		const group = { name: "archive", bundled: true, disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({ sessions: [{ group: "other", name: "s1" }] }),
		);

		render(<Groups />);
		await act(async () => {});
		expect(screen.getByTestId("storage-archive")).toHaveTextContent("-");
	});

	it("treats disabled groups as merged for storage size", async () => {
		const group = { name: "archive", disabled: true };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("");

		render(<Groups />);
		await act(async () => {});
		expect(storage.readFile).toHaveBeenCalledWith("local/sync/archive.json");
	});

	it("sums split storage only from json year files", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		storage.exists.mockResolvedValue(true);
		storage.getListing.mockResolvedValue([
			{ name: "2024.json" },
			{ name: "readme.txt" },
		]);
		storage.readFile.mockResolvedValue("abcd");

		render(<Groups />);
		await act(async () => {});
		expect(storage.readFile).toHaveBeenCalledWith(
			"local/sync/archive/2024.json",
		);
	});

	it("maps storage modes and indeterminate progress", async () => {
		const groups = [
			{ name: "bundled", bundled: true, disabled: false, color: "#111" },
			{ name: "merged", merged: true, disabled: false, color: "#222" },
			{ name: "split", disabled: false, color: "#333" },
			{ name: "hidden", disabled: true, color: "#444" },
		];
		useSessions.mockReturnValue([
			[{ group: "split" }],
			false,
			groups,
			jest.fn(),
		]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "split", progress: -1, count: 2, index: 0 }],
			busy: true,
			start: Date.now(),
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});
		GroupsStore.useState.mockReturnValue({ counter: 1, showDisabled: true });
		storage.exists.mockResolvedValue(false);

		render(<Groups />);
		await act(async () => {});
		expect(screen.getByTestId("storage-mode-bundled")).toHaveTextContent(
			"Bundled",
		);
		expect(screen.getByTestId("storage-mode-merged")).toHaveTextContent(
			"Merged",
		);
		expect(screen.getByTestId("storage-mode-split")).toHaveTextContent("Split");
		expect(screen.getByTestId("session-count-split")).toHaveTextContent("1");
		expect(screen.getByTestId("progress")).toBeInTheDocument();
		expect(screen.getByTestId("row-hidden")).toBeInTheDocument();
	});

	it("uses busy list layout without progress column when sync is idle", async () => {
		const group = { name: "archive", disabled: false };
		useSessions.mockReturnValue([[], false, [group], jest.fn()]);
		useUpdateSessions.mockReturnValue({
			status: [{ name: "archive", progress: 1, count: 2 }],
			busy: true,
			start: Date.now(),
			updateSessions: jest.fn(),
			updateAllSessions: jest.fn(),
			updateAllMetadataCurrentYear: jest.fn(),
			updateRecentSessions: jest.fn(),
			updateGroup: jest.fn(),
		});

		const { getByTestId } = render(<Groups />);
		await act(async () => {});
		expect(getByTestId("table").dataset.listClass).toContain("listItem");
	});
});
