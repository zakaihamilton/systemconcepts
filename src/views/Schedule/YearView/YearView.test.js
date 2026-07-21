import { useToolbar } from "@components/Toolbar";
import { fireEvent, render, screen } from "@testing-library/react";
import { useSwipe } from "@util/browser/touch";
import { useDirection } from "@util/data/direction";
import { useDateFormatter } from "@util/data/locale";
import { useTranslations } from "@util/domain/translations";
import YearView from "./YearView.js";

let swipeHandlers = {};

jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@util/browser/touch", () => ({
	useSwipe: jest.fn((handlers) => {
		swipeHandlers = handlers;
		return { "data-testid": "year-swipe" };
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
jest.mock("@widgets/Input", () => (props) => (
	<div data-testid={`input-${props.label}`}>
		{props.items?.map((item) => (
			<span key={item.id}>{item.name}</span>
		))}
	</div>
));
jest.mock("./Month", () => ({ date, sessions, store, playingSession }) => (
	<button
		type="button"
		data-testid={`month-${date.getMonth()}`}
		onClick={() =>
			store.update((s) => {
				s.date = date;
				s.viewMode = "month";
			})
		}
	>
		{date.getMonth()}-{sessions.length}-{playingSession || "none"}
	</button>
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

describe("YearView", () => {
	const translations = {
		BACK: "Back",
		TODAY: "Today",
		PREVIOUS_YEAR: "Prev",
		NEXT_YEAR: "Next",
		YEAR: "YEAR",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		swipeHandlers = {};
		useDirection.mockReturnValue("ltr");
		useTranslations.mockReturnValue(translations);
		useDateFormatter.mockImplementation(() => ({
			format: (date) => String(date.getFullYear()),
		}));
	});

	const renderYear = (props = {}) => {
		const store = props.store || createStore();
		const date = props.date || new Date(2024, 5, 15);
		return {
			store,
			...render(
				<YearView
					sessions={[]}
					date={date}
					store={store}
					playingSession={null}
					{...props}
				/>,
			),
		};
	};

	it("renders twelve months", () => {
		renderYear({
			sessions: [{ id: "1" }],
			playingSession: "Playing",
		});
		expect(screen.getAllByTestId(/^month-/)).toHaveLength(12);
		expect(screen.getByTestId("month-0")).toHaveTextContent("0-1-Playing");
	});

	it("navigates years via toolbar and year widget", () => {
		const store = createStore({ lastViewMode: "month" });
		renderYear({ store, date: new Date(2024, 5, 15) });

		getToolbarItem("previousYear").onClick();
		expect(store._state.date.getFullYear()).toBe(2023);

		// nextYear closes over currentYear from the rendered date prop
		getToolbarItem("nextYear").onClick();
		expect(store._state.date.getFullYear()).toBe(2025);

		getToolbarItem("today").onClick();
		expect(store._state.date.toDateString()).toBe(new Date().toDateString());

		getToolbarItem("yearWidget").element.props.state[1](2021);
		expect(store._state.date.getFullYear()).toBe(2021);

		getToolbarItem("back").onClick();
		expect(store._state.viewMode).toBe("month");
		expect(store._state.lastViewMode).toBeNull();
	});

	it("does nothing on back without lastViewMode", () => {
		const store = createStore({ lastViewMode: null });
		renderYear({ store });
		expect(getToolbarItem("back").disabled).toBe(true);
		getToolbarItem("back").onClick();
		expect(store._state.viewMode).toBeUndefined();
	});

	it("wires swipe handlers for ltr and rtl", () => {
		const store = createStore();
		renderYear({ store, date: new Date(2024, 0, 1) });
		swipeHandlers.onSwipeLeft();
		expect(store._state.date.getFullYear()).toBe(2025);

		const store2 = createStore();
		renderYear({ store: store2, date: new Date(2024, 0, 1) });
		swipeHandlers.onSwipeRight();
		expect(store2._state.date.getFullYear()).toBe(2023);

		useDirection.mockReturnValue("rtl");
		renderYear({ store: createStore(), date: new Date(2024, 0, 1) });
		expect(useSwipe).toHaveBeenCalled();
	});

	it("uses rtl icons in toolbar", () => {
		useDirection.mockReturnValue("rtl");
		renderYear();
		expect(getToolbarItem("previousYear").icon).toBeTruthy();
		expect(getToolbarItem("nextYear").icon).toBeTruthy();
		expect(getToolbarItem("back").icon).toBeTruthy();
	});

	it("forwards month click updates through store", () => {
		const store = createStore();
		renderYear({ store });
		fireEvent.click(screen.getByTestId("month-3"));
		expect(store._state.viewMode).toBe("month");
		expect(store._state.date.getMonth()).toBe(3);
	});
});
