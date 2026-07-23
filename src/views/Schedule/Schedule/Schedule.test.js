import { useSearch } from "@components/Search";
import { useToolbar } from "@components/Toolbar";
import { SyncActiveStore } from "@sync/syncState";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import SchedulePage, { ScheduleStore } from "./Schedule.js";

jest.mock("@util/browser/styles");
jest.mock("js-cookie");
jest.mock("@util/domain/translations");
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn().mockReturnValue({ showFilterDialog: false }),
		update: jest.fn(),
	},
}));
jest.mock("@components/Search");
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
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
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@components/ViewTransition", () => ({ children }) => (
	<div data-testid="view-transition">{children}</div>
));
jest.mock("../YearView", () => () => <div data-testid="year-view" />);
jest.mock("../MonthView", () => () => <div data-testid="month-view" />);
jest.mock("../WeekView", () => () => <div data-testid="week-view" />);
jest.mock("../DayView", () => () => <div data-testid="day-view" />);
jest.mock("../TracksView", () => () => <div data-testid="tracks-view" />);
jest.mock("../HistoryView", () => () => <div data-testid="history-view" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@views/Sessions/FilterBar", () => ({ hideYears }) => (
	<div data-testid="filter-bar" data-hide-years={String(!!hideYears)} />
));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@widgets/Message", () => () => <div data-testid="message" />);
jest.mock("@widgets/Tooltip", () => ({ children }) => <>{children}</>);
jest.mock(
	"@ui/IconButton",
	() =>
		({ children, onClick, "aria-label": label }) => (
			<button type="button" aria-label={label} onClick={onClick}>
				{children}
			</button>
		),
);

describe("Schedule View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		Cookies.get.mockReturnValue("test");
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			YEAR_VIEW: "Year",
			MONTH_VIEW: "Month",
			WEEK_VIEW: "Week",
			DAY_VIEW: "Day",
			TRACKS_VIEW: "Tracks",
			HISTORY_VIEW: "History",
			FILTER: "Filter",
			REQUIRE_SIGNIN: "Sign in required",
		});
		useSessions.mockReturnValue([[], false]);
		useSearch.mockReturnValue("");
		ScheduleStore.update((s) => {
			s.viewMode = "week";
			s.date = new Date("2024-06-10");
			s.lastViewMode = null;
		});
		SyncActiveStore.useState.mockImplementation((selector) => {
			const state = { needsSessionReload: false, busy: false };
			return typeof selector === "function" ? selector(state) : state;
		});
		SessionsStore.useState.mockReturnValue({ showFilterDialog: false });
	});

	it("renders status bar and filter bar", () => {
		render(<SchedulePage />);
		expect(screen.getByTestId("status-bar")).toBeInTheDocument();
		expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
	});

	it("renders week view by default", () => {
		render(<SchedulePage />);
		expect(screen.getByTestId("week-view")).toBeInTheDocument();
	});

	it("renders loading message when sessions are loading", () => {
		useSessions.mockReturnValue([[], true]);
		render(<SchedulePage />);
		expect(screen.getByTestId("message")).toBeInTheDocument();
	});

	it.each([
		["year", "year-view"],
		["month", "month-view"],
		["day", "day-view"],
		["tracks", "tracks-view"],
		["history", "history-view"],
		["week", "week-view"],
	])("switches to %s view from toolbar items", (mode, testId) => {
		render(<SchedulePage />);
		const viewGroup = useToolbar.mock.calls
			.at(-1)[0]
			.items.find((i) => i.id === "viewGroup");
		const { getByLabelText } = render(viewGroup.element);
		const labels = {
			year: "Year",
			month: "Month",
			week: "Week",
			day: "Day",
			tracks: "Tracks",
			history: "History",
		};
		fireEvent.click(getByLabelText(labels[mode]));
		expect(screen.getByTestId(testId)).toBeInTheDocument();
	});

	it("filters sessions by search name and tags", () => {
		useSearch.mockReturnValue("alpha");
		useSessions.mockReturnValue([
			[
				{ name: "Alpha Talk", tags: [] },
				{ name: "Other", tags: ["alpha-tag"] },
				{ name: "Skip", tags: ["beta"] },
			],
			false,
		]);
		render(<SchedulePage />);
		expect(screen.getByTestId("week-view")).toBeInTheDocument();
	});

	it("toggles filter dialog from toolbar", () => {
		render(<SchedulePage />);
		const filterItem = useToolbar.mock.calls
			.at(-1)[0]
			.items.find((i) => i.id === "filter");
		filterItem.onClick();
		expect(SessionsStore.update).toHaveBeenCalled();
		const state = { showFilterDialog: false, filterBarManuallyEnabled: false };
		SessionsStore.update.mock.calls.at(-1)[0](state);
		expect(state.showFilterDialog).toBe(true);
	});

	it("reloads sessions after sync completes", () => {
		SyncActiveStore.useState.mockImplementation((selector) => {
			const state = { needsSessionReload: true, busy: false };
			return typeof selector === "function" ? selector(state) : state;
		});
		render(<SchedulePage />);
		expect(SessionsStore.update).toHaveBeenCalled();
		expect(SyncActiveStore.update).toHaveBeenCalled();
	});

	it("sets signin mode when not signed in", () => {
		Cookies.get.mockReturnValue(null);
		render(<SchedulePage />);
		expect(ScheduleStore.getRawState().mode).toBe("signin");
	});

	it("places filter bar on mobile and omits view group", () => {
		useDeviceType.mockReturnValue("phone");
		ScheduleStore.update((s) => {
			s.viewMode = "tracks";
		});
		render(<SchedulePage />);
		expect(screen.getByTestId("filter-bar")).toHaveAttribute(
			"data-hide-years",
			"false",
		);
		const items = useToolbar.mock.calls.at(-1)[0].items;
		expect(items.find((i) => i.id === "viewGroup")).toBeUndefined();
		expect(items.find((i) => i.id === "filter").location).toBe("mobile");
	});

	it("clears signin mode when signed in", () => {
		Cookies.get.mockReturnValue("ok");
		render(<SchedulePage />);
		expect(ScheduleStore.getRawState().mode).toBe("");
	});
});
