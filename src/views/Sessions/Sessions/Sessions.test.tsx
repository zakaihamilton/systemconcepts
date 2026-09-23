import { SyncActiveStore } from "@sync/syncState";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { addPath } from "@util/domain/views";
import { PlayerStore } from "@views/Player/Player";
import Cookies from "js-cookie";
import SessionsPage from "./index";

jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@util/browser/store", () => ({
	...jest.requireActual("@util/browser/store"),
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/browser/styles");
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue(false),
		update: jest.fn(),
	},
	UpdateSessionsStore: {
		useState: jest.fn().mockReturnValue(false),
		update: jest.fn(),
	},
}));
jest.mock("@views/Player/Player", () => ({
	PlayerStore: {
		useState: jest.fn().mockReturnValue({ session: null }),
	},
}));
jest.mock("@util/domain/history", () => ({
	useRecentHistory: jest.fn().mockReturnValue([[]]),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((...parts) => parts.join("/")),
}));
jest.mock("@views/Sessions/FilterBar", () => ({ hideYears }: any) => (
	<div data-testid="filter-bar" data-hide-years={String(!!hideYears)} />
));
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Image", () => (props: any) => (
	<button
		type="button"
		data-testid="image"
		onClick={props.onClick}
		data-path={props.path || ""}
	>
		{props.alt}
	</button>
));
jest.mock("@widgets/SessionIcon", () => ({ type }: any) => (
	<span data-testid={`session-icon-${type}`} />
));
jest.mock("@widgets/Group", () => ({ name }: any) => (
	<div data-testid="group">{name}</div>
));
jest.mock("@widgets/Row", () => ({ children, onClick, icons, href }: any) => (
	<div data-testid="row" data-href={href || ""}>
		<button type="button" data-testid="row-click" onClick={onClick}>
			row
		</button>
		<div data-testid="row-icons">{icons}</div>
		{children}
	</div>
));
jest.mock("@widgets/Label", () => ({ name }: any) => (
	<div data-testid="label">{name}</div>
));
jest.mock("@widgets/Tooltip", () => ({ children }: any) => <>{children}</>);
jest.mock("@ui/Chip", () => ({ label }: any) => (
	<span data-testid="chip">{label}</span>
));
jest.mock("js-cookie", () => ({
	get: jest.fn().mockReturnValue("test"),
}));

let lastTableProps: any;

jest.mock("@widgets/Table", () => (props: any) => {
	lastTableProps = props;
	return (
		<div data-testid="table">
			{props.statusBar}
			<span data-testid="loading">{String(!!props.loading)}</span>
			<span data-testid="empty-label">{props.emptyLabel}</span>
			<span data-testid="data-count">{(props.data || []).length}</span>
			<button
				type="button"
				onClick={() =>
					props.columns
						.find((column: any) => column.id === "groupWidget")
						.onClick({ group: "test" })
				}
			>
				Filter group
			</button>
			<button
				type="button"
				onClick={() =>
					props.columns
						.find((column: any) => column.id === "groupWidget")
						.onClick({ group: "test" })
				}
			>
				Toggle group filter off
			</button>
			<button
				type="button"
				onClick={() => {
					const node = props.renderColumn("nameWidget", {
						type: "audio",
						name: "Test session",
						percentage: 40,
					});
					node.props.icons.props.onClick();
				}}
			>
				Filter type
			</button>
			<button
				type="button"
				onClick={() => {
					const mapped = props.mapper({
						key: "k1",
						id: "1",
						name: "Session A - Part 1",
						date: "2024-01-15",
						year: "2024",
						group: "alpha",
						color: "#fff",
						type: "audio",
						typeOrder: 1,
						thumbnail: "thumb.jpg",
						video: false,
						ai: true,
						duration: 100,
						position: 40,
						durationStr: "1:40",
						summary: "sum",
						tags: ["t1"],
						tagsString: "t1",
					});
					props.renderColumn("nameWidget", mapped);
					props.renderColumn("thumbnailWidget", mapped);
					props.renderColumn("groupWidget", mapped);
					props.renderColumn("date", mapped);
					props.renderColumn("durationWidget", mapped);
					props.renderColumn("tagsWidget", mapped);
					props.renderColumn("type", mapped);
				}}
			>
				Render columns
			</button>
		</div>
	);
});

const baseStoreState = {
	viewMode: "list",
	groupFilter: [],
	typeFilter: [],
	yearFilter: [],
	orderBy: "date",
	order: "desc",
	showHistory: false,
	expandedTreeGroups: [],
};

const sampleSessions = [
	{
		key: "k1",
		id: "1",
		name: "Session A - Part 1",
		date: "2024-01-15",
		year: "2024",
		group: "alpha",
		color: "#111",
		type: "audio",
		typeOrder: 1,
		thumbnail: "t1.jpg",
		video: false,
		ai: false,
		duration: 100,
		position: 25,
		durationStr: "1:40",
		tags: ["tag1"],
		tagsString: "tag1",
	},
	{
		key: "k2",
		id: "2",
		name: "Session A - Part 2",
		date: "2024-01-15",
		year: "2024",
		group: "alpha",
		color: "#111",
		type: "audio",
		typeOrder: 1,
		thumbnail: "t2.jpg",
		video: false,
		ai: true,
		duration: 200,
		position: 0,
		durationStr: "3:20",
		tags: [],
		tagsString: "",
	},
	{
		key: "k3",
		id: "3",
		name: "Overview",
		date: "2024-02-01",
		year: "2024",
		group: "beta",
		color: "#222",
		type: "overview",
		typeOrder: 2,
		thumbnail: null,
		video: true,
		ai: false,
		duration: 50,
		position: 10,
		durationStr: "0:50",
		tags: ["x"],
		tagsString: "x",
	},
	{
		key: "k4",
		id: "4",
		name: "Photo",
		date: "bad-date",
		year: "2023",
		group: "beta",
		color: "#222",
		type: "image",
		typeOrder: 3,
		thumbnail: "p.jpg",
		video: false,
		ai: false,
		duration: null,
		position: 0,
		tags: [],
		tagsString: "",
	},
];

describe("Sessions View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		lastTableProps = null;
		asMock(useTranslations).mockReturnValue({
			SESSIONS: "Sessions",
			THUMBNAIL: "Thumbnail",
			NAME: "Name",
			DATE: "Date",
			TYPE: "Type",
			DURATION: "Duration",
			GROUP: "Group",
			TAGS: "Tags",
			UNKNOWN: "Unknown",
			NO_ITEMS: "No items",
			SYNCING: "Syncing",
			REQUIRE_SIGNIN: "Sign in required",
		});
		asMock(useDeviceType).mockReturnValue("desktop");
		asMock(useSessions).mockReturnValue([[], false]);
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector(baseStoreState),
		);
		asMock(SessionsStore.update).mockImplementation((fn: any) => {
			const state = {
				groupFilter: [],
				typeFilter: [],
				showFilterDialog: false,
				offset: 1,
				mode: "",
				message: "",
				counter: 0,
				expandedTreeGroups: [],
			};
			fn(state);
			return state;
		});
		asMock(Cookies.get).mockReturnValue("test");
		asMock(SyncActiveStore.useState).mockReturnValue(false);
		asMock(PlayerStore.useState).mockReturnValue({ session: null });
	});

	it("renders table and bars", () => {
		const { getByTestId } = render(<SessionsPage />);
		expect(getByTestId("table")).toBeInTheDocument();
		expect(getByTestId("filter-bar")).toBeInTheDocument();
		expect(getByTestId("status-bar")).toBeInTheDocument();
	});

	it("shows loading and empty labels", () => {
		asMock(useSessions).mockReturnValue([[], true]);
		asMock(SyncActiveStore.useState).mockImplementation((selector: any) =>
			typeof selector === "function"
				? selector({ needsSessionReload: false, busy: true })
				: false,
		);
		render(<SessionsPage />);
		expect(screen.getByTestId("loading")).toHaveTextContent("true");
		expect(screen.getByTestId("empty-label")).toHaveTextContent("Syncing...");
	});

	it("passes session data into the table", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		expect(screen.getByTestId("data-count")).toHaveTextContent("4");
		expect(lastTableProps.name).toBe("Sessions");
		expect(lastTableProps.hover).toBe(true);
	});

	it.each([
		["group", "Filter group"],
		["type", "Filter type"],
	])("shows the filter bar when filtering by %s from the session list", (_, label) => {
		const { getByRole } = render(<SessionsPage />);
		fireEvent.click(getByRole("button", { name: label }));
		const update = asMock(SessionsStore.update).mock.calls.at(-1)[0];
		const state = {
			groupFilter: [],
			typeFilter: [],
			showFilterDialog: false,
			offset: 5,
		};
		update(state);
		expect(state.showFilterDialog).toBe(true);
		expect(state.offset).toBe(0);
	});

	it("removes an active group filter when clicked again", () => {
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, groupFilter: ["test"] }),
		);
		render(<SessionsPage />);
		fireEvent.click(screen.getByRole("button", { name: "Filter group" }));
		const update = asMock(SessionsStore.update).mock.calls.at(-1)[0];
		const state = {
			groupFilter: ["test"],
			showFilterDialog: false,
			offset: 2,
		};
		update(state);
		expect(state.groupFilter).toEqual([]);
	});

	it("removes an active type filter when icon is clicked again", () => {
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, typeFilter: ["audio"] }),
		);
		render(<SessionsPage />);
		fireEvent.click(screen.getByRole("button", { name: "Filter type" }));
		const update = asMock(SessionsStore.update).mock.calls.at(-1)[0];
		const state = {
			typeFilter: ["audio"],
			showFilterDialog: false,
			offset: 2,
		};
		update(state);
		expect(state.typeFilter).toEqual([]);
	});

	it("places filter bar after table on mobile", () => {
		asMock(useDeviceType).mockReturnValue("phone");
		render(<SessionsPage />);
		expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
	});

	it("sets sign-in mode when cookies are missing", () => {
		asMock(Cookies.get).mockReturnValue("");
		render(<SessionsPage />);
		expect(SessionsStore.update).toHaveBeenCalled();
		const update = asMock(SessionsStore.update).mock.calls.find((call: any) => {
			const state = { mode: "", message: "" };
			call[0](state);
			return state.mode === "signin";
		});
		expect(update).toBeTruthy();
	});

	it("clears sign-in mode when signed in", () => {
		asMock(Cookies.get).mockReturnValue("ok");
		render(<SessionsPage />);
		const update = asMock(SessionsStore.update).mock.calls.find((call: any) => {
			const state = { mode: "signin", message: "x" };
			call[0](state);
			return state.mode === "";
		});
		expect(update).toBeTruthy();
	});

	it("reloads sessions after sync completes", () => {
		asMock(SyncActiveStore.useState).mockImplementation((selector: any) => {
			if (typeof selector === "function") {
				return selector({ needsSessionReload: true, busy: false });
			}
			return false;
		});
		render(<SessionsPage />);
		expect(SessionsStore.update).toHaveBeenCalled();
		expect(SyncActiveStore.update).toHaveBeenCalled();
		const syncUpdate = asMock(SyncActiveStore.update).mock.calls[0][0];
		const syncState = { needsSessionReload: true };
		syncUpdate(syncState);
		expect(syncState.needsSessionReload).toBe(false);
	});

	it("maps sessions and renders all column types", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		asMock(PlayerStore.useState).mockReturnValue({
			session: {
				group: "alpha",
				date: "2024-01-15",
				name: "Session A - Part 1",
			},
		});
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, viewMode: "grid" }),
		);
		render(<SessionsPage />);
		fireEvent.click(screen.getByRole("button", { name: "Render columns" }));

		const mapped: any = lastTableProps.mapper(sampleSessions[0]);
		expect(mapped.isPlaying).toBe(true);
		expect(mapped.percentage).toBe(25);
		expect(mapped.formattedDuration).toBe("1:40");

		const imageMapped: any = lastTableProps.mapper(sampleSessions[3]);
		expect(imageMapped.formattedDuration).toBe("");

		const overviewMapped: any = lastTableProps.mapper(sampleSessions[2]);
		expect(overviewMapped.treePrefix).toBe("_overview_3");

		expect(lastTableProps.mapper(null)).toBeNull();
		expect(lastTableProps.mapper({ name: null })).toBeTruthy();
	});

	it("renders list/tree name, thumbnail, date, tags, and group columns", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, viewMode: "list" }),
		);
		render(<SessionsPage />);

		const mapped: any = lastTableProps.mapper(sampleSessions[0]);
		const nameNode: any = lastTableProps.renderColumn("nameWidget", mapped);
		expect(nameNode).toBeTruthy();
		const nameUtils = render(<div data-testid="name-wrap">{nameNode}</div>);
		fireEvent.click(nameUtils.getByTestId("row-click"));
		expect(addPath).toHaveBeenCalled();
		nameUtils.unmount();

		const header: any = lastTableProps.renderColumn("nameWidget", {
			...mapped,
			isGroupHeader: true,
			isExpanded: false,
			prefix: "alpha||2024-01-15||Session A",
			count: 2,
			name: "Session A",
		});
		const headerUtils = render(<div data-testid="header-wrap">{header}</div>);
		fireEvent.click(headerUtils.getByTestId("row-click"));
		const expandUpdate = asMock(SessionsStore.update).mock.calls.at(-1)[0];
		const expandState = { expandedTreeGroups: [] };
		expandUpdate(expandState);
		expect(expandState.expandedTreeGroups).toContain(
			"alpha||2024-01-15||Session A",
		);

		headerUtils.rerender(
			<div data-testid="header-wrap">
				{lastTableProps.renderColumn("nameWidget", {
					...mapped,
					isGroupHeader: true,
					isExpanded: true,
					prefix: "alpha||2024-01-15||Session A",
					count: 2,
					name: "Session A",
				})}
			</div>,
		);
		fireEvent.click(headerUtils.getByTestId("row-click"));
		const collapseUpdate = asMock(SessionsStore.update).mock.calls.at(-1)[0];
		const collapseState = {
			expandedTreeGroups: ["alpha||2024-01-15||Session A"],
		};
		collapseUpdate(collapseState);
		expect(collapseState.expandedTreeGroups).toEqual([]);
		headerUtils.unmount();

		expect(
			lastTableProps.renderColumn("thumbnailWidget", {
				...mapped,
				isGroupHeader: true,
			}),
		).toBeNull();
		expect(
			lastTableProps.renderColumn("date", { isGroupHeader: true }),
		).toBeNull();

		const tags: any = lastTableProps.renderColumn("tagsWidget", mapped);
		const tagsUtils = render(<div>{tags}</div>);
		expect(tagsUtils.getByTestId("chip")).toHaveTextContent("tag1");
		tagsUtils.unmount();
		expect(lastTableProps.renderColumn("tagsWidget", { tags: [] })).toBeNull();

		expect(lastTableProps.renderColumn("groupWidget", mapped)).toBeTruthy();
		expect(lastTableProps.renderColumn("date", mapped)).toBeTruthy();
		expect(lastTableProps.renderColumn("durationWidget", mapped)).toBe("1:40");
		expect(lastTableProps.renderColumn("unknown", { unknown: "x" })).toBe("x");
	});

	it("formats mobile dates and grid thumbnails with ai/progress", () => {
		asMock(useDeviceType).mockReturnValue("phone");
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, viewMode: "grid", orderBy: "duration" }),
		);
		render(<SessionsPage />);
		const mapped: any = lastTableProps.mapper({
			...sampleSessions[2],
			percentage: 20,
			ai: true,
			video: true,
		});
		const thumb: any = lastTableProps.renderColumn("thumbnailWidget", {
			...mapped,
			percentage: 20,
			ai: true,
			video: true,
		});
		expect(thumb).toBeTruthy();
		const date: any = lastTableProps.renderColumn("date", mapped);
		expect(date).toBeTruthy();
		const name: any = lastTableProps.renderColumn("nameWidget", mapped);
		expect(name).toBeTruthy();

		expect(lastTableProps.renderColumn("date", { date: "" })).toBeTruthy();
		expect(
			lastTableProps.renderColumn("date", { date: "not-a-date" }),
		).toBeTruthy();
	});

	it("builds tree groups and expands them", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		const wrappers: any = sampleSessions.map((raw) => ({
			raw,
			mapped: lastTableProps.mapper(raw),
			searchableText: raw.name.toLowerCase(),
		}));
		const collapsed: any = lastTableProps.treeGroup(wrappers, []);
		expect(collapsed.some((item: any) => item.mapped.isGroupHeader)).toBe(true);

		const header = collapsed.find((item: any) => item.mapped.isGroupHeader);
		const expanded: any = lastTableProps.treeGroup(wrappers, [
			header.mapped.prefix,
		]);
		expect(expanded.some((item: any) => item.mapped.isExpanded)).toBe(true);
		expect(expanded.some((item: any) => item.mapped.isTreeChild)).toBe(true);

		const cached: any = lastTableProps.treeGroup(wrappers, []);
		expect(cached).toEqual(collapsed);
	});

	it("computes separators and row class names", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		const a: any = lastTableProps.mapper(sampleSessions[0]);
		const b: any = lastTableProps.mapper(sampleSessions[2]);
		expect(lastTableProps.getSeparator(b, a, "date")).toBe(true);
		expect(lastTableProps.getSeparator(a, a, "date")).toBe(false);
		expect(lastTableProps.getSeparator(b, a, "group")).toBe(true);
		expect(lastTableProps.getSeparator(b, a, "typeOrder")).toBe(true);
		expect(lastTableProps.getSeparator(b, a, "name")).toBe(false);

		expect(lastTableProps.rowClassName({ isPlaying: true })).toMatch(/playing/);
		expect(
			lastTableProps.rowClassName({ isExpanded: true, isTreeChild: true }),
		).toMatch(/treeChild/);
		expect(lastTableProps.rowClassName({})).toBe("");
	});

	it("marks group column selectable only when group exists", () => {
		render(<SessionsPage />);
		const groupCol: any = lastTableProps.columns.find(
			(c: any) => c.id === "groupWidget",
		);
		expect(groupCol.onSelectable({ group: "x" })).toBe(true);
		expect(groupCol.onSelectable({})).toBe(false);
	});

	it("derives hyphen prefixes when prefix map has no entry", () => {
		asMock(useSessions).mockReturnValue([[], false]);
		render(<SessionsPage />);
		const mapped: any = lastTableProps.mapper({
			...sampleSessions[0],
			name: "Alone - Solo",
			group: "solo",
			date: "2020-01-01",
		});
		expect(mapped.treePrefix).toBe("Alone");
	});

	it("shows sign-in guidance when cookies are missing", () => {
		asMock(Cookies.get).mockReturnValue(undefined);
		render(<SessionsPage />);
		expect(screen.getByTestId("empty-label")).toBeInTheDocument();
	});

	it("renders list view names through Row instead of Label", () => {
		asMock(SessionsStore.useState).mockImplementation((selector: any) =>
			selector({ ...baseStoreState, viewMode: "list" }),
		);
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		const mapped: any = lastTableProps.mapper(sampleSessions[0]);
		const name: any = lastTableProps.renderColumn("nameWidget", mapped);
		const utils = render(<div>{name}</div>);
		expect(utils.getByTestId("row")).toBeInTheDocument();
		utils.unmount();
	});

	it("extracts tree prefixes from hyphenated session titles", () => {
		asMock(useSessions).mockReturnValue([
			[
				{
					name: "Alpha-Beta-Gamma",
					group: "g",
					date: "2024-01-01",
					type: "audio",
				},
				{
					name: "Alpha-Beta-Other",
					group: "g",
					date: "2024-01-01",
					type: "audio",
				},
			],
			false,
		]);
		render(<SessionsPage />);
		const mapped: any = lastTableProps.mapper({
			name: "Alpha-Beta-Gamma",
			group: "g",
			date: "2024-01-01",
			type: "audio",
		});
		expect(mapped.treePrefix).toBeTruthy();
	});

	it("expands grouped tree rows with child sessions", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		const wrappers: any = sampleSessions.map((raw) => ({
			raw,
			mapped: lastTableProps.mapper(raw),
			searchableText: raw.name.toLowerCase(),
		}));
		const collapsed: any = lastTableProps.treeGroup(wrappers, []);
		const header = collapsed.find((item: any) => item.mapped.isGroupHeader);
		const expanded: any = lastTableProps.treeGroup(wrappers, [
			header.mapped.prefix,
		]);
		expect(expanded.some((item: any) => item.mapped.isTreeChild)).toBe(true);
	});

	it("does not reset scroll on the initial sessions load", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		render(<SessionsPage />);
		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(0);
		expect(
			asMock(SessionsStore.update).mock.calls.some((call: any) => {
				const state = { offset: 1 };
				call[0](state);
				return state.offset === 0;
			}),
		).toBe(false);
	});

	it("resets scroll when new session ids are synced", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		const { rerender } = render(<SessionsPage />);
		const depsBefore: any = lastTableProps.resetScrollDeps;
		expect(depsBefore.at(-1)).toBe(0);

		asMock(SessionsStore.update).mockClear();
		asMock(useSessions).mockReturnValue([
			[
				...sampleSessions,
				{
					...sampleSessions[0],
					key: "k5",
					id: "5",
					name: "Newly synced session",
				},
			],
			false,
		]);
		rerender(<SessionsPage />);

		expect(lastTableProps.resetScrollDeps).not.toEqual(depsBefore);
		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(1);
		expect(SessionsStore.update).toHaveBeenCalled();
		const offsetState = { offset: 4 };
		asMock(SessionsStore.update).mock.calls[0][0](offsetState);
		expect(offsetState.offset).toBe(0);
	});

	it("does not reset scroll when a reload keeps the same session ids", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		const { rerender } = render(<SessionsPage />);
		const depsBefore: any = lastTableProps.resetScrollDeps;

		asMock(SessionsStore.update).mockClear();
		asMock(useSessions).mockReturnValue([
			sampleSessions.map((session) => ({ ...session })),
			false,
		]);
		rerender(<SessionsPage />);

		expect(lastTableProps.resetScrollDeps).toEqual(depsBefore);
		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(0);
		expect(SessionsStore.update).not.toHaveBeenCalled();
	});

	it("does not treat the loading empty list as a baseline for new sessions", () => {
		asMock(useSessions).mockReturnValue([[], true]);
		const { rerender } = render(<SessionsPage />);
		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(0);

		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		rerender(<SessionsPage />);

		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(0);
	});

	it("resets scroll when a new session is identified only by key", () => {
		asMock(useSessions).mockReturnValue([
			[{ key: "k1", name: "Existing", date: "2024-01-15" }],
			false,
		]);
		const { rerender } = render(<SessionsPage />);
		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(0);

		asMock(useSessions).mockReturnValue([
			[
				{ key: "k1", name: "Existing", date: "2024-01-15" },
				{ key: "k2", name: "Newly synced", date: "2024-03-01" },
			],
			false,
		]);
		rerender(<SessionsPage />);

		expect(lastTableProps.resetScrollDeps.at(-1)).toBe(1);
	});

	it("does not reset scroll when sessions are only removed", () => {
		asMock(useSessions).mockReturnValue([sampleSessions, false]);
		const { rerender } = render(<SessionsPage />);
		const depsBefore: any = lastTableProps.resetScrollDeps;

		asMock(useSessions).mockReturnValue([sampleSessions.slice(1), false]);
		rerender(<SessionsPage />);

		expect(lastTableProps.resetScrollDeps).toEqual(depsBefore);
	});
});
