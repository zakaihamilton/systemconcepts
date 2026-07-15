import { fireEvent, render, within } from "@testing-library/react";
import { useRecentHistory } from "@util/domain/history";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { setPath, usePages } from "@util/domain/views";
import { ScheduleStore } from "@views/Schedule/Schedule";
import Apps from "./index.js";

jest.mock("@util/domain/history");
jest.mock("@util/domain/sessions");
jest.mock("@util/domain/translations");
jest.mock("@util/domain/views");
jest.mock("@views/Schedule/Schedule", () => ({
	ScheduleStore: { update: jest.fn() },
}));
jest.mock(
	"@views/Schedule/TracksView/Card",
	() =>
		({ session, onSessionClick }) => (
			<div
				data-testid="track-card"
				data-thumbnail={session.thumbnail}
				onClick={onSessionClick}
			>
				{session.name}
			</div>
		),
);

describe("Apps View", () => {
	const mockPages = [
		{
			id: "app1",
			name: "App 1",
			apps: true,
			Icon: () => <div data-testid="icon1" />,
		},
		{
			id: "app2",
			name: "App 2",
			apps: true,
			Icon: () => <div data-testid="icon2" />,
		},
		{ id: "page1", name: "Page 1", apps: false },
	];
	const mockSessions = [
		{
			group: "alpha",
			year: "2025",
			date: "2025-03-12",
			name: "Latest session",
			duration: 100,
			position: 20,
			type: "video",
			image: { path: "wasabi/sessions/latest.jpg" },
		},
		{
			group: "alpha",
			year: "2025",
			date: "2025-02-12",
			name: "Earlier session",
			duration: 90,
			type: "audio",
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		window.localStorage.clear();
		usePages.mockReturnValue(mockPages);
		useSessions.mockReturnValue([mockSessions, false]);
		useRecentHistory.mockReturnValue([[mockSessions[0]]]);
		useTranslations.mockReturnValue({
			APPS: "Apps",
			SESSIONS: "Sessions",
			CONTINUE_WATCHING: "Continue watching",
			LATEST_SESSIONS: "Latest sessions",
			ALL_SESSIONS: "All sessions",
			NO_SESSIONS_YET: "No sessions yet.",
			LOADING: "Loading",
		});
	});

	it("renders continue watching, latest sessions, and app shortcuts", () => {
		const { getByText, getAllByText, getAllByTestId, getByTestId } = render(
			<Apps />,
		);
		expect(getByText("Continue watching")).toBeInTheDocument();
		expect(getByText("Latest sessions")).toBeInTheDocument();
		expect(getAllByText("Latest session")).toHaveLength(2);
		expect(getAllByTestId("track-card")).toHaveLength(3);
		expect(getAllByTestId("track-card")[0]).toHaveAttribute(
			"data-thumbnail",
			"wasabi/sessions/latest.jpg",
		);
		expect(getByText("Earlier session")).toBeInTheDocument();
		expect(getByTestId("icon1")).toBeInTheDocument();
		expect(getByTestId("icon2")).toBeInTheDocument();
	});

	it("sorts quick access apps", () => {
		const { getByTestId } = render(<Apps />);
		const links = within(getByTestId("app-quick-access-items")).getAllByRole(
			"link",
		);
		expect(links).toHaveLength(2);
		expect(links[0]).toHaveTextContent("App 2");
		expect(links[1]).toHaveTextContent("App 1");
	});

	it("places quick access before the session sections", () => {
		const { getByTestId, getByText } = render(<Apps />);
		const quickAccess = getByTestId("app-quick-access-items");
		const continueWatching = getByText("Continue watching");
		expect(
			quickAccess.compareDocumentPosition(continueWatching) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("opens a session detail and links section titles to schedule views", () => {
		const { getAllByText, getByText } = render(<Apps />);
		fireEvent.click(getAllByText("Latest session")[0]);
		expect(setPath).toHaveBeenCalledWith(
			"sessions",
			"session?group=alpha&year=2025&date=2025-03-12&name=Latest%20session",
		);

		fireEvent.click(getByText("Continue watching"));
		expect(ScheduleStore.update).toHaveBeenCalled();
		const historyState = {};
		ScheduleStore.update.mock.calls[0][0](historyState);
		expect(historyState.viewMode).toBe("history");
		expect(historyState.lastViewMode).toBeNull();
		expect(
			JSON.parse(window.localStorage.getItem("ScheduleStore")),
		).toMatchObject({
			viewMode: "history",
			lastViewMode: null,
		});
		expect(setPath).toHaveBeenLastCalledWith("schedule");

		fireEvent.click(getByText("Latest sessions"));
		expect(ScheduleStore.update).toHaveBeenCalledTimes(2);
		const weekState = {};
		ScheduleStore.update.mock.calls[1][0](weekState);
		expect(weekState.viewMode).toBe("week");
		expect(weekState.lastViewMode).toBeNull();
		expect(
			JSON.parse(window.localStorage.getItem("ScheduleStore")),
		).toMatchObject({
			viewMode: "week",
			lastViewMode: null,
		});
		expect(setPath).toHaveBeenLastCalledWith("schedule");
	});

	it("omits stale history entries and renders the empty state", () => {
		useSessions.mockReturnValue([[], false]);
		useRecentHistory.mockReturnValue([[mockSessions[0]]]);
		const { getAllByText } = render(<Apps />);
		expect(getAllByText("No sessions yet.")).toHaveLength(2);
	});

	it("uses track-card skeletons while sessions load", () => {
		useSessions.mockReturnValue([[], true]);
		const { getAllByTestId } = render(<Apps />);
		expect(getAllByTestId("session-skeletons")).toHaveLength(2);
	});

	it("shows two desktop rows of latest sessions", () => {
		const sessions = Array.from({ length: 9 }, (_, index) => ({
			...mockSessions[0],
			name: `Session ${index + 1}`,
			date: `2025-03-${String(index + 1).padStart(2, "0")}`,
		}));
		useSessions.mockReturnValue([sessions, false]);
		useRecentHistory.mockReturnValue([[]]);

		const { getByLabelText } = render(<Apps />);
		expect(
			within(getByLabelText("Latest sessions")).getAllByTestId("track-card"),
		).toHaveLength(8);
	});

	it("keeps skeletons visible while the session store initializes", () => {
		useSessions.mockReturnValue([null, false]);
		const { getAllByTestId } = render(<Apps />);
		expect(getAllByTestId("session-skeletons")).toHaveLength(2);
	});
});
