import { render, screen } from "@testing-library/react";
import { isDayToday } from "@util/data/date";
import DayHeader from "./DayHeader.js";

jest.mock("@util/data/date", () => ({
	isDayToday: jest.fn(),
}));

describe("MonthView DayHeader", () => {
	it("renders weekday and marks today/last", () => {
		isDayToday.mockReturnValue(true);
		render(
			<DayHeader
				date={new Date("2024-06-10")}
				index={6}
				count={7}
				dateFormatter={{ format: () => "Mon" }}
			/>,
		);
		expect(screen.getByText("Mon")).toBeInTheDocument();
	});

	it("renders non-today mid week", () => {
		isDayToday.mockReturnValue(false);
		render(
			<DayHeader
				date={new Date()}
				index={2}
				count={7}
				dateFormatter={{ format: () => "Wed" }}
			/>,
		);
		expect(screen.getByText("Wed")).toBeInTheDocument();
	});
});
