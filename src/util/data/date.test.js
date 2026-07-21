import {
	addDate,
	diffDays,
	getDateString,
	getDaysInMonth,
	getMonthNames,
	getMonthViewEnd,
	getMonthViewStart,
	getNumberOfWeeksInMonth,
	getWeekOfMonth,
	getWeekViewEnd,
	getWeekViewStart,
	getYearNames,
	isDateMonth,
	isDateToday,
	isDayToday,
	setWeekOfMonth,
} from "./date";

describe("getMonthViewStart", () => {
	it("returns the Sunday on or before the 1st of the month", () => {
		const result = getMonthViewStart(new Date(2024, 0, 15));
		expect(result.getFullYear()).toBe(2023);
		expect(result.getMonth()).toBe(11);
		expect(result.getDate()).toBe(31);
		expect(result.getDay()).toBe(0);
	});

	it("returns the 1st itself when it is already a Sunday", () => {
		const result = getMonthViewStart(new Date(2026, 1, 15));
		expect(result.getFullYear()).toBe(2026);
		expect(result.getMonth()).toBe(1);
		expect(result.getDate()).toBe(1);
	});
});

describe("getMonthViewEnd", () => {
	it("returns the Saturday on or after the last day of the month", () => {
		const result = getMonthViewEnd(new Date(2024, 0, 15));
		expect(result.getFullYear()).toBe(2024);
		expect(result.getMonth()).toBe(1);
		expect(result.getDate()).toBe(3);
		expect(result.getDay()).toBe(6);
	});
});

describe("getWeekViewStart", () => {
	it("returns the Sunday of the current week", () => {
		const result = getWeekViewStart(new Date(2024, 0, 15));
		expect(result.getFullYear()).toBe(2024);
		expect(result.getMonth()).toBe(0);
		expect(result.getDate()).toBe(14);
		expect(result.getDay()).toBe(0);
	});
});

describe("getWeekViewEnd", () => {
	it("returns the Saturday of the current week", () => {
		const result = getWeekViewEnd(new Date(2024, 0, 15));
		expect(result.getFullYear()).toBe(2024);
		expect(result.getMonth()).toBe(0);
		expect(result.getDate()).toBe(20);
		expect(result.getDay()).toBe(6);
	});
});

describe("addDate", () => {
	it("adds a positive number of days", () => {
		const result = addDate(new Date(2024, 0, 15), 5);
		expect(result.getDate()).toBe(20);
	});

	it("subtracts when given a negative number", () => {
		const result = addDate(new Date(2024, 0, 15), -5);
		expect(result.getDate()).toBe(10);
	});

	it("rolls over to the next month", () => {
		const result = addDate(new Date(2024, 0, 31), 1);
		expect(result.getMonth()).toBe(1);
		expect(result.getDate()).toBe(1);
	});
});

describe("isDateToday", () => {
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("returns true for the current date", () => {
		expect(isDateToday(new Date(2024, 0, 15))).toBe(true);
	});

	it("returns false for a different day", () => {
		expect(isDateToday(new Date(2024, 0, 16))).toBe(false);
	});

	it("returns false for a different month", () => {
		expect(isDateToday(new Date(2024, 1, 15))).toBe(false);
	});

	it("returns false for a different year", () => {
		expect(isDateToday(new Date(2023, 0, 15))).toBe(false);
	});
});

describe("isDayToday", () => {
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("returns true when the day of week, month and year all match", () => {
		expect(isDayToday(new Date(2024, 0, 22))).toBe(true);
	});

	it("returns false for a different day of week", () => {
		expect(isDayToday(new Date(2024, 0, 16))).toBe(false);
	});

	it("returns false for a different month", () => {
		expect(isDayToday(new Date(2024, 1, 19))).toBe(false);
	});

	it("returns false for a different year", () => {
		expect(isDayToday(new Date(2023, 0, 22))).toBe(false);
	});
});

describe("isDateMonth", () => {
	it("returns true when month and year match", () => {
		expect(isDateMonth(new Date(2024, 0, 15), new Date(2024, 0, 1))).toBe(true);
	});

	it("returns false when the month differs", () => {
		expect(isDateMonth(new Date(2024, 0, 15), new Date(2024, 1, 1))).toBe(
			false,
		);
	});

	it("returns false when the year differs", () => {
		expect(isDateMonth(new Date(2024, 0, 15), new Date(2023, 0, 1))).toBe(
			false,
		);
	});
});

describe("diffDays", () => {
	it("returns the number of days between two dates", () => {
		expect(diffDays(new Date(2024, 0, 1), new Date(2024, 0, 15))).toBe(14);
	});

	it("is order independent", () => {
		expect(diffDays(new Date(2024, 0, 15), new Date(2024, 0, 1))).toBe(14);
	});

	it("returns 0 for the same date", () => {
		const date = new Date(2024, 0, 15);
		expect(diffDays(date, date)).toBe(0);
	});
});

describe("getWeekOfMonth", () => {
	it("returns the 0-indexed week for a mid-month date", () => {
		expect(getWeekOfMonth(new Date(2024, 0, 15))).toBe(2);
	});

	it("returns 0 for the first day of the month view", () => {
		expect(getWeekOfMonth(new Date(2024, 0, 1))).toBe(0);
	});

	it("caps the result at 4 for the last week of the month", () => {
		expect(getWeekOfMonth(new Date(2024, 0, 31))).toBe(4);
	});
});

describe("setWeekOfMonth", () => {
	it("moves the date back to an earlier week", () => {
		const date = new Date(2024, 0, 15);
		setWeekOfMonth(date, 0);
		expect(date.getFullYear()).toBe(2024);
		expect(date.getMonth()).toBe(0);
		expect(date.getDate()).toBe(1);
	});

	it("moves the date forward to a later week", () => {
		const date = new Date(2024, 0, 15);
		setWeekOfMonth(date, 4);
		expect(date.getMonth()).toBe(0);
		expect(date.getDate()).toBe(29);
	});
});

describe("getNumberOfWeeksInMonth", () => {
	it("returns 0 for an invalid date", () => {
		expect(getNumberOfWeeksInMonth(new Date("invalid"))).toBe(0);
	});

	it("returns 0 for a falsy value", () => {
		expect(getNumberOfWeeksInMonth(null)).toBe(0);
	});

	it("returns 5 for a typical month", () => {
		expect(getNumberOfWeeksInMonth(new Date(2024, 0, 15))).toBe(5);
	});

	it("returns 4 for a month that fits exactly into 4 weeks", () => {
		expect(getNumberOfWeeksInMonth(new Date(2015, 1, 10))).toBe(4);
	});

	it("caps the result at 5 weeks", () => {
		expect(getNumberOfWeeksInMonth(new Date(2011, 0, 15))).toBe(5);
	});
});

describe("getMonthNames", () => {
	it("formats all 12 months using the provided formatter", () => {
		const formatter = new Intl.DateTimeFormat("en-US", { month: "long" });
		const result = getMonthNames(new Date(2024, 0, 15), formatter);
		expect(result).toHaveLength(12);
		expect(result[0]).toBe("January");
		expect(result[11]).toBe("December");
	});
});

describe("getYearNames", () => {
	it("formats a range of years using the provided formatter", () => {
		const formatter = new Intl.DateTimeFormat("en-US", { year: "numeric" });
		const result = getYearNames(new Date(2024, 0, 15), formatter, 2020, 2023);
		expect(result).toEqual(["2020", "2021", "2022", "2023"]);
	});
});

describe("getDateString", () => {
	it("formats a date as YYYY-MM-DD with zero padding", () => {
		expect(getDateString(new Date(2024, 0, 15))).toBe("2024-01-15");
	});

	it("pads single-digit months and days", () => {
		expect(getDateString(new Date(2024, 8, 5))).toBe("2024-09-05");
	});

	it("does not pad double-digit months and days", () => {
		expect(getDateString(new Date(2024, 10, 25))).toBe("2024-11-25");
	});
});

describe("getDaysInMonth", () => {
	it("returns 31 for January", () => {
		expect(getDaysInMonth(new Date(2024, 0, 15))).toBe(31);
	});

	it("returns 29 for a leap year February", () => {
		expect(getDaysInMonth(new Date(2024, 1, 10))).toBe(29);
	});

	it("returns 28 for a non-leap year February", () => {
		expect(getDaysInMonth(new Date(2023, 1, 10))).toBe(28);
	});

	it("returns 31 for December", () => {
		expect(getDaysInMonth(new Date(2024, 11, 15))).toBe(31);
	});
});
