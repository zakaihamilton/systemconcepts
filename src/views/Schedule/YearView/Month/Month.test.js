import { fireEvent, render, screen } from "@testing-library/react";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import Month from "./Month.js";

jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-title={title}>{children}</div>
));

function createStore(initial = {}) {
	const state = { ...initial };
	return {
		update: jest.fn((fn) => fn(state)),
		_state: state,
	};
}

describe("YearView Month", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			WEEK_VIEW: "Week view",
			MONTH_VIEW: "Month view",
		});
		useDateFormatter.mockImplementation((opts = {}) => ({
			format: (date) => {
				if (opts.month) return "June";
				if (opts.day) return String(date.getDate());
				return "fmt";
			},
		}));
	});

	it("navigates to month view when title is clicked", () => {
		const store = createStore();
		const date = new Date(2024, 5, 1);
		render(
			<Month date={date} sessions={[]} store={store} playingSession={null} />,
		);

		fireEvent.click(screen.getByText("June"));
		expect(store._state.viewMode).toBe("month");
		expect(store._state.lastViewMode).toBe("year");
		expect(store._state.date).toBe(date);
	});

	it("navigates to day view when a day is clicked", () => {
		const store = createStore();
		render(
			<Month
				date={new Date(2024, 5, 1)}
				sessions={[{ date: "2024-06-15", name: "Live" }]}
				store={store}
				playingSession="Live"
			/>,
		);

		fireEvent.click(screen.getByText("15"));
		expect(store._state.viewMode).toBe("day");
		expect(store._state.lastViewMode).toBe("year");
		expect(store._state.date.getDate()).toBe(15);
	});

	it("navigates to week view when week indicator is clicked", () => {
		const store = createStore();
		const { container } = render(
			<Month
				date={new Date(2024, 5, 1)}
				sessions={null}
				store={store}
				playingSession={null}
			/>,
		);

		const weekIndicators = container.querySelectorAll(
			"[class*='weekIndicator']",
		);
		expect(weekIndicators.length).toBeGreaterThan(0);
		fireEvent.click(weekIndicators[0]);
		expect(store._state.viewMode).toBe("week");
		expect(store._state.lastViewMode).toBe("year");
	});

	it("marks days with sessions and playing state", () => {
		const { container } = render(
			<Month
				date={new Date(2024, 5, 1)}
				sessions={[
					{ date: "2024-06-10", name: "A" },
					{ date: "2024-06-11", name: "Playing" },
				]}
				store={createStore()}
				playingSession="Playing"
			/>,
		);

		const days = Array.from(container.querySelectorAll("[class*='day']"));
		const withSession = days.filter((el) =>
			(el.className || "").includes("hasSession"),
		);
		const playing = days.filter((el) =>
			(el.className || "").includes("playing"),
		);
		expect(withSession.length).toBeGreaterThanOrEqual(2);
		expect(playing.length).toBeGreaterThanOrEqual(1);
	});
});
