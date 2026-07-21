import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSwipe } from "@util/browser/touch";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import { addPath } from "@util/domain/views";
import MonthView from "./MonthView.js";

let swipeHandlers = {};
let sessionsProps = null;

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
		return { "data-testid": "month-swipe" };
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
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn((path) => path),
}));
jest.mock("@util/data/colors", () => ({
	getSessionTextColor: jest.fn(() => "#fff"),
}));
jest.mock("@widgets/Input", () => (props) => (
	<div data-testid={`input-${props.label}`}>{props.items?.length}</div>
));
jest.mock("@widgets/SessionIcon", () => ({ type }) => (
	<span data-testid={`session-icon-${type}`} />
));
jest.mock("./DayHeader", () => ({ index }) => (
	<div data-testid={`day-header-${index}`} />
));
jest.mock("./Week", () => (props) => (
	<div data-testid={`week-row-${props.row}`}>
		<button
			type="button"
			data-testid={`open-day-${props.row}`}
			onClick={() => props.onOpenDay(new Date(2024, 5, 15))}
		>
			open
		</button>
		<button
			type="button"
			data-testid={`menu-open-${props.row}`}
			onClick={() => props.onMenuVisible(true)}
		>
			menu
		</button>
	</div>
));
jest.mock("./Sessions", () => (props) => {
	sessionsProps = props;
	if (!props.open) return null;
	return (
		<div data-testid="sessions-popup">
			<button type="button" onClick={props.onClose}>
				close
			</button>
			<button type="button" onClick={props.onSwipeLeft}>
				swipe-left
			</button>
			<button type="button" onClick={props.onSwipeRight}>
				swipe-right
			</button>
			{props.items.map((item) => (
				<button
					key={item.id}
					type="button"
					data-testid={`popup-item-${item.id}`}
					onClick={item.onClick}
				>
					{item.name}
				</button>
			))}
		</div>
	);
});

function createStore(initial = {}) {
	const state = { lastViewMode: null, ...initial };
	return {
		useState: jest.fn(() => ({ ...state })),
		update: jest.fn((fn) => fn(state)),
		_state: state,
	};
}

function getToolbarItem(id) {
	return useToolbar.mock.calls.at(-1)[0].items.find((item) => item.id === id);
}

function getWidgetState(id) {
	return getToolbarItem(id).element.props.state;
}

describe("MonthView", () => {
	const translations = {
		BACK: "Back",
		TODAY: "Today",
		PREVIOUS_MONTH: "Prev",
		NEXT_MONTH: "Next",
		MONTH: "MONTH",
		YEAR: "YEAR",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		swipeHandlers = {};
		sessionsProps = null;
		useDeviceType.mockReturnValue("desktop");
		useDirection.mockReturnValue("ltr");
		useTranslations.mockReturnValue(translations);
		useDateFormatter.mockImplementation((opts = {}) => ({
			format: (date) => {
				if (opts.weekday) return opts.weekday === "narrow" ? "M" : "Mon";
				if (opts.month === "short") return "Jun";
				if (opts.month) return "June";
				if (opts.day) return String(date.getDate());
				if (opts.year) return String(date.getFullYear());
				return "fmt";
			},
		}));
	});

	const renderMonth = (props = {}) => {
		const store = props.store || createStore();
		const date = props.date || new Date(2024, 5, 15);
		return {
			store,
			...render(
				<MonthView
					sessions={[]}
					date={date}
					store={store}
					playingSession={null}
					{...props}
				/>,
			),
		};
	};

	it("renders day headers and week rows", () => {
		renderMonth();
		expect(screen.getAllByTestId(/^day-header-/)).toHaveLength(7);
		expect(screen.getAllByTestId(/^week-row-/).length).toBeGreaterThan(3);
	});

	it("navigates months and today via toolbar", () => {
		const store = createStore({ lastViewMode: "year" });
		renderMonth({ store, date: new Date(2024, 5, 15) });

		getToolbarItem("previousMonth").onClick();
		expect(store._state.date.getMonth()).toBe(4);

		// nextMonth closes over month from the rendered date prop (June → July)
		getToolbarItem("nextMonth").onClick();
		expect(store._state.date.getMonth()).toBe(6);

		getToolbarItem("today").onClick();
		expect(store._state.date.toDateString()).toBe(new Date().toDateString());

		getToolbarItem("back").onClick();
		expect(store._state.viewMode).toBe("year");
		expect(store._state.lastViewMode).toBeNull();
	});

	it("blocks navigation past year boundaries", () => {
		const early = createStore();
		renderMonth({ store: early, date: new Date(2015, 0, 1) });
		expect(getToolbarItem("previousMonth").disabled).toBe(true);
		getToolbarItem("previousMonth").onClick();
		expect(early.update).not.toHaveBeenCalled();

		const lateYear = new Date().getFullYear() + 2;
		const late = createStore();
		renderMonth({ store: late, date: new Date(lateYear, 11, 1) });
		expect(getToolbarItem("nextMonth").disabled).toBe(true);
		getToolbarItem("nextMonth").onClick();
		expect(late.update).not.toHaveBeenCalled();
	});

	it("updates month and year widgets", () => {
		const store = createStore();
		renderMonth({ store, date: new Date(2024, 5, 15) });

		getWidgetState("monthWidget")[1](1);
		expect(store._state.date.getMonth()).toBe(0);

		getWidgetState("yearWidget")[1](2020);
		expect(store._state.date.getFullYear()).toBe(2020);
	});

	it("opens day popup with filtered session items and navigates", () => {
		const sessions = [
			{
				name: "Morning",
				group: "alpha",
				year: "2024",
				date: "2024-06-15",
				type: "audio",
				color: "#123456",
			},
			{
				name: "Other",
				group: "beta",
				year: "2024",
				date: "2024-06-16",
				type: "video",
				color: "#000",
			},
		];
		renderMonth({ sessions });

		fireEvent.click(screen.getByTestId("open-day-2"));
		expect(screen.getByTestId("sessions-popup")).toBeInTheDocument();
		expect(screen.getByTestId("popup-item-Morning")).toBeInTheDocument();
		expect(screen.queryByTestId("popup-item-Other")).not.toBeInTheDocument();

		fireEvent.click(screen.getByTestId("popup-item-Morning"));
		expect(addPath).toHaveBeenCalledWith(
			"session?&group=alpha&year=2024&date=2024-06-15&name=Morning",
		);

		fireEvent.click(screen.getByText("close"));
		expect(screen.queryByTestId("sessions-popup")).not.toBeInTheDocument();
	});

	it("swipes popup days and disables root swipe while popup is open", () => {
		renderMonth({
			sessions: [
				{
					name: "S",
					group: "g",
					year: "2024",
					date: "2024-06-15",
					type: "audio",
					color: "#111",
				},
			],
		});

		fireEvent.click(screen.getByTestId("open-day-2"));
		const openDate = sessionsProps.date.getTime();
		fireEvent.click(screen.getByText("swipe-left"));
		expect(sessionsProps.date.getTime()).toBeGreaterThan(openDate);

		fireEvent.click(screen.getByText("swipe-right"));
		expect(sessionsProps.date.getTime()).toBe(openDate);
	});

	it("applies rtl swipe mapping and phone formatters", () => {
		useDirection.mockReturnValue("rtl");
		useDeviceType.mockReturnValue("phone");
		renderMonth();
		expect(useDateFormatter).toHaveBeenCalledWith({ weekday: "narrow" });
		expect(useDateFormatter).toHaveBeenCalledWith({ month: "short" });
		expect(useSwipe).toHaveBeenCalled();
		expect(swipeHandlers.onSwipeLeft).toEqual(expect.any(Function));
	});

	it("disables today when viewing current month and back without history", () => {
		renderMonth({
			date: new Date(),
			store: createStore({ lastViewMode: null }),
		});
		expect(getToolbarItem("today").disabled).toBe(true);
		expect(getToolbarItem("back").disabled).toBe(true);
		getToolbarItem("back").onClick();
	});

	it("handles null sessions when building popup items", () => {
		renderMonth({ sessions: null });
		fireEvent.click(screen.getByTestId("open-day-2"));
		expect(sessionsProps.items).toEqual([]);
	});
});
