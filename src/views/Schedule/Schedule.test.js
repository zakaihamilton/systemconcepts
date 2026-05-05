import { useSearch } from "@components/Search";
import { render } from "@testing-library/react";
import { useSessions } from "@util/sessions";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import Cookies from "js-cookie";
import SchedulePage from "./Schedule";

jest.mock("@util/styles");
jest.mock("js-cookie");
jest.mock("@util/translations");
jest.mock("@util/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn().mockReturnValue({ showFilterDialog: false }),
		update: jest.fn(),
	},
}));
jest.mock("@components/Search");
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
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
jest.mock("./YearView", () => () => <div data-testid="year-view" />);
jest.mock("./MonthView", () => () => <div data-testid="month-view" />);
jest.mock("./WeekView", () => () => <div data-testid="week-view" />);
jest.mock("./DayView", () => () => <div data-testid="day-view" />);
jest.mock("./TracksView", () => () => <div data-testid="tracks-view" />);
jest.mock("./HistoryView", () => () => <div data-testid="history-view" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@views/Sessions/FilterBar", () => () => (
	<div data-testid="filter-bar" />
));
jest.mock("@widgets/Table", () => ({ statusBar }) => (
	<div data-testid="table">{statusBar}</div>
));
jest.mock("@widgets/Message", () => () => <div data-testid="message" />);

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
		});
		useSessions.mockReturnValue([[], false]);
		useSearch.mockReturnValue("");
	});

	it("renders status bar and filter bar", () => {
		const { getByTestId } = render(<SchedulePage />);
		expect(getByTestId("status-bar")).toBeInTheDocument();
		expect(getByTestId("filter-bar")).toBeInTheDocument();
	});

	it("renders week view by default", () => {
		const { getByTestId } = render(<SchedulePage />);
		expect(getByTestId("week-view")).toBeInTheDocument();
	});

	it("renders loading message when sessions are loading", () => {
		useSessions.mockReturnValue([[], true]);
		const { getByTestId } = render(<SchedulePage />);
		expect(getByTestId("message")).toBeInTheDocument();
	});
});
