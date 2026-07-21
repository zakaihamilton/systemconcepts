import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import WeekView from "./WeekView.js";

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
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
jest.mock("@widgets/Input", () => (props) => (
	<div data-testid={`input-${props.label}`} data-class={props.className || ""}>
		{props.items?.map((item) => (
			<span key={item.id}>{item.name}</span>
		))}
	</div>
));
jest.mock("./DayHeader", () => ({ date, index }) => (
	<div data-testid={`day-header-${index}`}>
		{date.toISOString().slice(0, 10)}
	</div>
));
jest.mock("./Week", () => (props) => (
	<div data-testid="week-grid">
		<button
			type="button"
			data-testid="toggle-group"
			onClick={() => props.onToggleGroup("alpha")}
		>
			toggle
		</button>
		<span data-testid="collapsed">{props.collapsedGroups.join(",")}</span>
		<span data-testid="week-date">{props.date.toISOString().slice(0, 10)}</span>
		<span data-testid="week-sessions">{props.sessions.length}</span>
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
	return useToolbar.mock.calls.at(-1)[0].items.find((item) => item.id === id);
}

function getWidgetState(id) {
	return getToolbarItem(id).element.props.state;
}

function getWidgetItems(id) {
	return getToolbarItem(id).element.props.items;
}

describe("WeekView", () => {
	const translations = {
		BACK: "Back",
		TODAY: "Today",
		PREVIOUS_WEEK: "Prev week",
		NEXT_WEEK: "Next week",
		WEEK: "WEEK",
		MONTH: "MONTH",
		YEAR: "YEAR",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
		useDirection.mockReturnValue("ltr");
		useTranslations.mockReturnValue(translations);
		useDateFormatter.mockImplementation((opts = {}) => ({
			format: (date) => {
				if (opts.weekday) return "Mon";
				if (opts.month === "short") return "Jun";
				if (opts.month) return "June";
				if (opts.day) return String(date.getDate());
				if (opts.year) return String(date.getFullYear());
				return "fmt";
			},
		}));
	});

	const renderWeek = (props = {}) => {
		const store = props.store || createStore();
		const date = props.date || new Date(2024, 5, 12);
		return {
			store,
			...render(
				<WeekView
					sessions={[]}
					date={date}
					store={store}
					playingSession={null}
					{...props}
				/>,
			),
		};
	};

	it("renders day headers and week grid", () => {
		renderWeek({
			sessions: [{ id: "1", date: "2024-06-12", group: "a", name: "S" }],
		});
		expect(screen.getAllByTestId(/^day-header-/)).toHaveLength(7);
		expect(screen.getByTestId("week-sessions")).toHaveTextContent("1");
	});

	it("toggles collapsed groups", () => {
		renderWeek();
		expect(screen.getByTestId("collapsed")).toHaveTextContent("");
		fireEvent.click(screen.getByTestId("toggle-group"));
		expect(screen.getByTestId("collapsed")).toHaveTextContent("alpha");
		fireEvent.click(screen.getByTestId("toggle-group"));
		expect(screen.getByTestId("collapsed")).toHaveTextContent("");
	});

	it("navigates previous/next week and today via toolbar", () => {
		const store = createStore({ lastViewMode: "month" });
		const date = new Date(2024, 5, 12);
		renderWeek({ store, date });

		getToolbarItem("previousWeek").onClick();
		expect(store._state.date.getTime()).toBeLessThan(date.getTime());

		const afterPrev = store._state.date.getTime();
		getToolbarItem("nextWeek").onClick();
		// nextWeek closes over firstDay from props, not store
		expect(store._state.date.getTime()).not.toBe(afterPrev);

		getToolbarItem("today").onClick();
		expect(store._state.date.toDateString()).toBe(new Date().toDateString());

		getToolbarItem("back").onClick();
		expect(store._state.viewMode).toBe("month");
		expect(store._state.lastViewMode).toBeNull();
	});

	it("disables back without lastViewMode and today when already on this week", () => {
		const today = new Date();
		renderWeek({ date: today, store: createStore({ lastViewMode: null }) });
		expect(getToolbarItem("back").disabled).toBe(true);
		expect(getToolbarItem("today").disabled).toBe(true);
		getToolbarItem("back").onClick();
	});

	it("updates date from week, month, and year widgets", () => {
		const store = createStore();
		renderWeek({ store, date: new Date(2024, 5, 12) });

		getWidgetState("weekWidget")[1](1);
		expect(store.update).toHaveBeenCalled();

		getWidgetState("monthWidget")[1](3);
		// Month widget jumps to the first week start of that month (may be prior month)
		expect(store._state.date.getMonth()).toBeLessThanOrEqual(2);
		expect(store.update).toHaveBeenCalled();

		getWidgetState("yearWidget")[1](2023);
		expect(store._state.date.getFullYear()).toBe(2023);
	});

	it("extends year list for far-future years", () => {
		renderWeek({ date: new Date(2100, 0, 5) });
		const years = getWidgetItems("yearWidget").map((item) => item.id);
		expect(years).toContain(2100);
	});

	it("applies phone styles and rtl toolbar icons", () => {
		useDeviceType.mockReturnValue("phone");
		useDirection.mockReturnValue("rtl");
		renderWeek();
		expect(useDateFormatter).toHaveBeenCalledWith({ month: "short" });
		expect(getToolbarItem("previousWeek").icon).toBeTruthy();
		expect(getToolbarItem("nextWeek").icon).toBeTruthy();
	});

	it("disables previous week at the earliest boundary", () => {
		renderWeek({ date: new Date(2015, 0, 1) });
		expect(getToolbarItem("previousWeek").disabled).toBe(true);
	});

	it("clamps the year picker when the system year is before 2015", () => {
		const RealDate = global.Date;
		const mockedNow = new RealDate(2010, 0, 1).getTime();
		const dateSpy = jest.spyOn(global, "Date").mockImplementation((...args) => {
			if (args.length === 0) {
				return new RealDate(2010, 0, 1);
			}
			return new RealDate(...args);
		});
		global.Date.now = jest.fn(() => mockedNow);
		global.Date.UTC = RealDate.UTC;
		global.Date.parse = RealDate.parse;

		renderWeek({ date: new RealDate(2010, 0, 5) });
		const years = getWidgetItems("yearWidget").map((item) => item.id);
		expect(years).toContain(2015);

		dateSpy.mockRestore();
	});
});
