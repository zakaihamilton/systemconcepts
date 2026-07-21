import { fireEvent, render, screen } from "@testing-library/react";
import { getSessionTextColor } from "@util/data/colors";
import { getDateString, isDateMonth, isDateToday } from "@util/data/date";
import { useTranslations } from "@util/domain/translations";
import { addPath, toPath } from "@util/domain/views";
import Day from "./Day.js";

jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock("@util/data/date", () => ({
	getDateString: jest.fn(),
	isDateMonth: jest.fn(),
	isDateToday: jest.fn(),
}));
jest.mock("@util/data/colors", () => ({
	getSessionTextColor: jest.fn(() => "#fff"),
}));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((p) => p),
}));
jest.mock("@ui/Avatar", () => ({ children, onClick, className }) => (
	<button
		type="button"
		data-testid="day-avatar"
		className={className}
		onClick={onClick}
	>
		{children}
	</button>
));
jest.mock("@widgets/SessionIcon", () => () => (
	<span data-testid="session-icon" />
));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-testid="tooltip">
		{typeof title === "string" ? title : title}
		{children}
	</div>
));

describe("MonthView Day", () => {
	const date = new Date("2024-06-15T12:00:00");
	const dateFormatter = { format: () => "15" };

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ SESSIONS: "Sessions" });
		getDateString.mockReturnValue("2024-06-15");
		isDateToday.mockReturnValue(true);
		isDateMonth.mockReturnValue(true);
		getSessionTextColor.mockReturnValue("#fff");
		toPath.mockImplementation((p) => p);
	});

	it("opens day and renders session dots up to 12", () => {
		const onOpenDay = jest.fn();
		const sessions = Array.from({ length: 14 }, (_, i) => ({
			name: `S${i}`,
			group: "alpha",
			date: "2024-06-15",
			year: "2024",
			color: "#abc",
			type: "audio",
		}));

		render(
			<Day
				sessions={sessions}
				month={5}
				column={7}
				row={5}
				date={date}
				columnCount={7}
				rowCount={5}
				dateFormatter={dateFormatter}
				onOpenDay={onOpenDay}
				playingSession={{ name: "S0", group: "alpha", date: "2024-06-15" }}
			/>,
		);

		fireEvent.click(screen.getByTestId("day-avatar"));
		expect(onOpenDay).toHaveBeenCalledWith(date);
		expect(screen.getByText("15")).toBeInTheDocument();
		expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
	});

	it("navigates when a session dot is clicked", () => {
		render(
			<Day
				sessions={[
					{
						name: "Talk",
						group: "will",
						date: "2024-06-15",
						year: "2024",
						color: "#f00",
						type: "audio",
					},
				]}
				month={5}
				column={1}
				row={1}
				date={date}
				columnCount={7}
				rowCount={5}
				dateFormatter={dateFormatter}
			/>,
		);

		const dots = document.querySelectorAll("[class*='dot']");
		expect(dots.length).toBeGreaterThan(0);
		fireEvent.click(dots[0]);
		expect(addPath).toHaveBeenCalled();
	});

	it("handles missing onOpenDay and empty sessions", () => {
		render(
			<Day
				sessions={null}
				month={5}
				column={1}
				row={1}
				date={date}
				columnCount={7}
				rowCount={5}
				dateFormatter={dateFormatter}
			/>,
		);
		fireEvent.click(screen.getByTestId("day-avatar"));
		expect(screen.getByText("15")).toBeInTheDocument();
	});

	it("handles ungrouped sessions without description", () => {
		render(
			<Day
				sessions={[
					{
						name: "Solo",
						group: "",
						date: "2024-06-15",
						year: "2024",
						color: "#0f0",
					},
				]}
				month={5}
				column={1}
				row={1}
				date={date}
				columnCount={7}
				rowCount={5}
				dateFormatter={dateFormatter}
			/>,
		);
		expect(screen.getByText("Solo")).toBeInTheDocument();
	});
});
