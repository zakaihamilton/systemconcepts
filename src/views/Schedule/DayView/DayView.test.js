import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { getDateString } from "@util/data/date";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import DayView from "./DayView.js";

let swipeHandlers = {};

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/browser/touch", () => ({
	useSwipe: jest.fn((handlers) => {
		swipeHandlers = handlers;
		return { "data-testid": "day-swipe" };
	}),
}));
jest.mock("@util/data/direction", () => ({
	useDirection: jest.fn(),
}));
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock("@components/Widgets/Input", () => (props) => (
	<div data-testid={`input-${props.label}`}>
		{props.items?.map((item) => (
			<span key={item.id}>{item.name}</span>
		))}
	</div>
));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-testid="tooltip" data-title={title}>
		{children}
	</div>
));
jest.mock("./SessionGroup", () => ({ group, sessions, playingSession }) => (
	<div data-testid={`session-group-${group}`}>
		<span>{group}</span>
		<span data-testid={`count-${group}`}>{sessions.length}</span>
		{playingSession ? (
			<span data-testid={`playing-${group}`}>{playingSession.name}</span>
		) : null}
	</div>
));

function createStore(initial = {}) {
	const state = { lastViewMode: null, ...initial };
	return {
		useState: jest.fn(() => ({ ...state })),
		update: jest.fn((fn) => fn(state)),
		_state: state,
	};
}

function getToolbarItem(id) {
	const lastCall = useToolbar.mock.calls.at(-1)[0];
	return lastCall.items.find((item) => item.id === id);
}

function getWidgetState(id) {
	return getToolbarItem(id).element.props.state;
}

function getWidgetItems(id) {
	return getToolbarItem(id).element.props.items;
}

describe("DayView", () => {
	const translations = {
		BACK: "Back",
		TODAY: "Today",
		PREVIOUS_DAY: "Previous",
		NEXT_DAY: "Next",
		DAY: "DAY",
		MONTH: "MONTH",
		YEAR: "YEAR",
		WEEK_VIEW: "Week view",
		MONTH_VIEW: "Month view",
		YEAR_VIEW: "Year view",
		NO_SESSIONS: "No sessions today",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		swipeHandlers = {};
		useDeviceType.mockReturnValue("desktop");
		useDirection.mockReturnValue("ltr");
		useTranslations.mockReturnValue(translations);
		useDateFormatter.mockImplementation((opts = {}) => ({
			format: (date) => {
				if (opts.weekday) return "Monday";
				if (opts.month) return opts.month === "short" ? "Jan" : "January";
				if (opts.day) return String(date.getDate());
				if (opts.year) return String(date.getFullYear());
				return "formatted";
			},
			formatWithOrdinal: (date) => `${date.getDate()}th`,
		}));
	});

	const renderDay = (props = {}) => {
		const store = props.store || createStore();
		const date = props.date || new Date(2024, 5, 15);
		return {
			store,
			date,
			...render(
				<DayView
					sessions={[]}
					date={date}
					store={store}
					playingSession={null}
					{...props}
				/>,
			),
		};
	};

	it("shows empty state when there are no sessions for the day", () => {
		renderDay({
			sessions: [{ id: "1", date: "2024-06-14", group: "a", name: "Other" }],
		});
		expect(screen.getByText("No sessions today")).toBeInTheDocument();
	});

	it("falls back to default empty text when translation is missing", () => {
		useTranslations.mockReturnValue({
			...translations,
			NO_SESSIONS: undefined,
		});
		renderDay();
		expect(screen.getByText("No sessions")).toBeInTheDocument();
	});

	it("groups and sorts sessions for the selected day", () => {
		const date = new Date(2024, 5, 15);
		renderDay({
			date,
			sessions: [
				{ id: "1", date: "2024-06-15", group: "zeta", name: "Z" },
				{ id: "2", date: "2024-06-15", group: "alpha", name: "A" },
				{ id: "3", date: "2024-06-15", group: "alpha", name: "B" },
				{ id: "4", date: "2024-06-16", group: "alpha", name: "Skip" },
			],
			playingSession: { name: "A", group: "alpha", date: "2024-06-15" },
		});

		const groups = screen.getAllByTestId(/^session-group-/);
		expect(groups.map((el) => el.getAttribute("data-testid"))).toEqual([
			"session-group-alpha",
			"session-group-zeta",
		]);
		expect(screen.getByTestId("count-alpha")).toHaveTextContent("2");
		expect(screen.getByTestId("playing-alpha")).toHaveTextContent("A");
	});

	it("navigates to week, month, and year via title links", () => {
		const { store } = renderDay();

		fireEvent.click(screen.getByText("Monday"));
		expect(store._state.viewMode).toBe("week");
		expect(store._state.lastViewMode).toBe("day");

		fireEvent.click(screen.getByText(/15th January/));
		expect(store._state.viewMode).toBe("month");

		fireEvent.click(screen.getByText("2024"));
		expect(store._state.viewMode).toBe("year");
	});

	it("registers toolbar actions for navigation and widgets", () => {
		const store = createStore({ lastViewMode: "week" });
		const date = new Date(2024, 5, 15);
		renderDay({ store, date });

		expect(useToolbar).toHaveBeenCalledWith(
			expect.objectContaining({ id: "DayView" }),
		);

		getToolbarItem("previousDay").onClick();
		expect(getDateString(store._state.date)).toBe("2024-06-14");

		// Handlers close over the rendered date prop, so next goes from June 15 → 16
		getToolbarItem("nextDay").onClick();
		expect(getDateString(store._state.date)).toBe("2024-06-16");

		getToolbarItem("today").onClick();
		expect(getDateString(store._state.date)).toBe(getDateString(new Date()));

		getToolbarItem("back").onClick();
		expect(store._state.viewMode).toBe("week");
		expect(store._state.lastViewMode).toBeNull();
	});

	it("disables today when viewing today and back when no lastViewMode", () => {
		const today = new Date();
		renderDay({ date: today, store: createStore({ lastViewMode: null }) });

		expect(getToolbarItem("today").disabled).toBe(true);
		expect(getToolbarItem("back").disabled).toBe(true);

		getToolbarItem("back").onClick();
		expect(useToolbar.mock.calls.length).toBeGreaterThan(0);
	});

	it("updates date from day, month, and year widgets", () => {
		const store = createStore();
		const date = new Date(2024, 5, 15);
		renderDay({ store, date });

		getWidgetState("dayWidget")[1](10);
		expect(store._state.date.getDate()).toBe(10);

		getWidgetState("monthWidget")[1](2);
		expect(store._state.date.getMonth()).toBe(1);

		getWidgetState("yearWidget")[1](2025);
		expect(store._state.date.getFullYear()).toBe(2025);
	});

	it("clamps day when switching to a shorter month", () => {
		const store = createStore();
		renderDay({ store, date: new Date(2024, 0, 31) });

		getWidgetState("monthWidget")[1](2);
		expect(store._state.date.getMonth()).toBe(1);
		expect(store._state.date.getDate()).toBe(29);
	});

	it("extends year items when current year exceeds default end", () => {
		renderDay({ date: new Date(2099, 0, 1) });
		const years = getWidgetItems("yearWidget").map((item) => item.id);
		expect(years).toContain(2099);
	});

	it("wires swipe handlers for ltr and rtl", () => {
		const store = createStore();
		const date = new Date(2024, 5, 15);
		renderDay({ store, date });

		swipeHandlers.onSwipeLeft();
		expect(getDateString(store._state.date)).toBe("2024-06-16");

		const store2 = createStore();
		renderDay({ store: store2, date });
		swipeHandlers.onSwipeRight();
		expect(getDateString(store2._state.date)).toBe("2024-06-14");

		useDirection.mockReturnValue("rtl");
		renderDay({ store: createStore(), date });
		expect(useSwipe).toHaveBeenCalledWith(
			expect.objectContaining({
				onSwipeLeft: expect.any(Function),
				onSwipeRight: expect.any(Function),
			}),
		);
	});

	it("uses short month names on phone", () => {
		useDeviceType.mockReturnValue("phone");
		renderDay();
		expect(useDateFormatter).toHaveBeenCalledWith({ month: "short" });
	});
});
