import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { isDateToday } from "@util/data/date";
import DayHeader from "./DayHeader";

jest.mock("@util/browser/styles", () => ({
	useDeviceType: jest.fn(),
}));
jest.mock("@util/data/date", () => ({
	isDateToday: jest.fn(),
}));

describe("WeekView DayHeader", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		asMock(useDeviceType).mockReturnValue("desktop");
		asMock(isDateToday).mockReturnValue(true);
	});

	it("renders day/date and switches to day view on click", () => {
		const store = { update: jest.fn((fn) => fn({} as Record<string, any>)) };
		const date = new Date("2024-06-10");
		render(
			<DayHeader
				date={date}
				index={6}
				count={7}
				store={store}
				dayFormatter={{ format: () => "Mon" }}
				dateFormatter={{ format: () => "10" }}
			/>,
		);
		expect(screen.getByText("Mon")).toBeInTheDocument();
		expect(screen.getByText("10")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Mon"));
		expect(store.update).toHaveBeenCalled();
		const state: Record<string, any> = {};
		asMock(store.update).mock.calls[0][0](state);
		expect(state.viewMode).toBe("day");
		expect(state.lastViewMode).toBe("week");
	});

	it("applies mobile styles", () => {
		asMock(useDeviceType).mockReturnValue("phone");
		asMock(isDateToday).mockReturnValue(false);
		render(
			<DayHeader
				date={new Date()}
				index={0}
				count={7}
				store={{ update: jest.fn() }}
				dayFormatter={{ format: () => "Tue" }}
				dateFormatter={{ format: () => "11" }}
			/>,
		);
		expect(screen.getByText("Tue")).toBeInTheDocument();
	});
});
