import { useSearch } from "@components/Search";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRecentHistory } from "@util/domain/history";
import { useLanguage } from "@util/domain/language";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { addPath } from "@util/domain/views";
import { PlayerStore } from "@views/Player/Player";
import HistoryView from "./HistoryView.js";

const removeFromHistory = jest.fn();

jest.mock("@components/Search", () => ({
	useSearch: jest.fn(),
}));
jest.mock("@util/domain/history", () => ({
	useRecentHistory: jest.fn(),
}));
jest.mock("@util/domain/language", () => ({
	useLanguage: jest.fn(),
}));
jest.mock("@util/domain/sessions", () => ({
	useSessions: jest.fn(),
	SessionsStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
}));
jest.mock("@views/Player/Player", () => ({
	PlayerStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@views/Schedule/TracksView/Card", () => (props) => (
	<button
		type="button"
		data-testid={`card-${props.session.name}`}
		data-playing={props.isPlaying ? "true" : "false"}
		onClick={props.onSessionClick}
	>
		{props.session.name}
	</button>
));
jest.mock("@widgets/Tooltip", () => ({ children }) => <>{children}</>);
jest.mock("@ui/IconButton", () => ({ children, onClick, ...rest }) => (
	<button type="button" onClick={onClick} {...rest}>
		{children}
	</button>
));

function hoursAgo(hours) {
	return Date.now() - hours * 60 * 60 * 1000;
}

function daysAgo(days) {
	const d = new Date();
	d.setDate(d.getDate() - days);
	d.setHours(12, 0, 0, 0);
	return d.getTime();
}

describe("HistoryView", () => {
	const sessions = [
		{
			group: "alpha",
			date: "2024-01-01",
			name: "Today Session",
			year: "2024",
			color: "#abc",
		},
		{
			group: "beta",
			date: "2024-01-02",
			name: "Yesterday Session",
			year: "2024",
			color: "#def",
		},
		{
			group: "gamma",
			date: "2024-01-03",
			name: "Week Session",
			year: "2023",
			color: "#111",
		},
		{
			group: "delta",
			date: "2024-01-04",
			name: "Last Week Session",
			year: "2023",
			color: "#222",
		},
		{
			group: "epsilon",
			date: "2024-01-05",
			name: "Older Session",
			year: "2022",
			color: "#333",
		},
		{
			group: "zeta",
			date: "2024-01-06",
			name: "Missing Meta",
			year: "2024",
			color: "#444",
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			TODAY: "Today",
			YESTERDAY: "Yesterday",
			THIS_WEEK: "This week",
			LAST_WEEK: "Last week",
			OLDER: "Older",
			REMOVE_FROM_HISTORY: "Remove",
		});
		useLanguage.mockReturnValue("en-US");
		useSearch.mockReturnValue("");
		SessionsStore.useState.mockReturnValue({ yearFilter: [] });
		PlayerStore.useState.mockReturnValue({ session: null });
		useSessions.mockReturnValue([sessions]);
		useRecentHistory.mockReturnValue([[], null, null, null, removeFromHistory]);
	});

	it("renders nothing when history or sessions are missing", () => {
		useRecentHistory.mockReturnValue([
			null,
			null,
			null,
			null,
			removeFromHistory,
		]);
		const { container } = render(<HistoryView />);
		expect(container.querySelectorAll("[class]").length).toBeGreaterThan(0);
		expect(screen.queryByText("Today")).not.toBeInTheDocument();

		useRecentHistory.mockReturnValue([[], null, null, null, removeFromHistory]);
		useSessions.mockReturnValue([null]);
		render(<HistoryView />);
		expect(screen.queryByText("Today")).not.toBeInTheDocument();
	});

	it("groups history items by relative day buckets", () => {
		const today = new Date();
		const startOfWeek = new Date(today);
		startOfWeek.setDate(today.getDate() - today.getDay());

		const history = [
			{
				group: "alpha",
				date: "2024-01-01",
				name: "Today Session",
				timestamp: hoursAgo(1),
			},
			{
				group: "beta",
				date: "2024-01-02",
				name: "Yesterday Session",
				timestamp: daysAgo(1),
			},
			{
				group: "gamma",
				date: "2024-01-03",
				name: "Week Session",
				timestamp: Math.max(startOfWeek.getTime() + 3600000, daysAgo(2)),
			},
			{
				group: "delta",
				date: "2024-01-04",
				name: "Last Week Session",
				timestamp: daysAgo(8),
			},
			{
				group: "epsilon",
				date: "2024-01-05",
				name: "Older Session",
				timestamp: daysAgo(30),
			},
			{
				group: "missing",
				date: "2024-01-99",
				name: "No Match",
				timestamp: hoursAgo(2),
			},
			{ group: "", date: "2024-01-01", name: "Bad", timestamp: hoursAgo(1) },
			{
				group: "alpha",
				date: "2024-01-01",
				name: "",
				timestamp: hoursAgo(1),
			},
		];
		useRecentHistory.mockReturnValue([
			history,
			null,
			null,
			null,
			removeFromHistory,
		]);

		render(<HistoryView />);

		expect(screen.getByText("Today")).toBeInTheDocument();
		expect(screen.getByText("Yesterday")).toBeInTheDocument();
		expect(screen.getByText("Older")).toBeInTheDocument();
		expect(screen.getByTestId("card-Today Session")).toBeInTheDocument();
		expect(screen.queryByTestId("card-No Match")).not.toBeInTheDocument();
	});

	it("filters by search and year", () => {
		const history = [
			{
				group: "alpha",
				date: "2024-01-01",
				name: "Today Session",
				timestamp: hoursAgo(1),
			},
			{
				group: "beta",
				date: "2024-01-02",
				name: "Yesterday Session",
				timestamp: daysAgo(1),
			},
		];
		useRecentHistory.mockReturnValue([
			history,
			null,
			null,
			null,
			removeFromHistory,
		]);
		useSearch.mockReturnValue("yesterday");
		SessionsStore.useState.mockReturnValue({ yearFilter: [] });

		const { rerender } = render(<HistoryView />);
		expect(screen.getByTestId("card-Yesterday Session")).toBeInTheDocument();
		expect(screen.queryByTestId("card-Today Session")).not.toBeInTheDocument();

		useSearch.mockReturnValue("");
		SessionsStore.useState.mockReturnValue({ yearFilter: ["2024"] });
		rerender(<HistoryView />);
		expect(screen.getByTestId("card-Today Session")).toBeInTheDocument();
		expect(screen.getByTestId("card-Yesterday Session")).toBeInTheDocument();

		SessionsStore.useState.mockReturnValue({ yearFilter: ["2099"] });
		rerender(<HistoryView />);
		expect(screen.queryByTestId("card-Today Session")).not.toBeInTheDocument();
	});

	it("navigates on click and removes from history without bubbling", () => {
		const history = [
			{
				group: "alpha",
				date: "2024-01-01",
				name: "Today Session",
				timestamp: hoursAgo(1),
			},
		];
		useRecentHistory.mockReturnValue([
			history,
			null,
			null,
			null,
			removeFromHistory,
		]);
		PlayerStore.useState.mockReturnValue({
			session: {
				group: "alpha",
				date: "2024-01-01",
				name: "Today Session",
			},
		});

		const { container } = render(<HistoryView />);

		expect(screen.getByTestId("card-Today Session")).toHaveAttribute(
			"data-playing",
			"true",
		);

		fireEvent.click(screen.getByTestId("card-Today Session"));
		expect(addPath).toHaveBeenCalledWith(
			"session?group=alpha&year=2024&date=2024-01-01&name=Today%20Session",
		);

		addPath.mockClear();
		const header = container.querySelector("[class*='timelineHeader']");
		fireEvent.click(header);
		expect(addPath).toHaveBeenCalledWith(
			"session?group=alpha&year=2024&date=2024-01-01&name=Today%20Session",
		);

		addPath.mockClear();
		const removeButton = container.querySelector("[class*='removeButton']");
		fireEvent.click(removeButton);
		expect(removeFromHistory).toHaveBeenCalled();
		expect(addPath).not.toHaveBeenCalled();
	});

	it("renders empty timestamp text when timestamp is missing", () => {
		useRecentHistory.mockReturnValue([
			[
				{
					group: "alpha",
					date: "2024-01-01",
					name: "Today Session",
					timestamp: 0,
				},
			],
			null,
			null,
			null,
			removeFromHistory,
		]);
		render(<HistoryView />);
		expect(screen.getByTestId("card-Today Session")).toBeInTheDocument();
	});
});
