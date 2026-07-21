import { getScheduleSection } from "./Section.js";

const update = jest.fn();
let rawState = { viewMode: "week" };

jest.mock("@views/Schedule/Schedule", () => ({
	ScheduleStore: {
		getRawState: () => rawState,
		update: (...args) => update(...args),
	},
}));

describe("getScheduleSection", () => {
	const translations = {
		YEAR_VIEW: "Year",
		MONTH_VIEW: "Month",
		WEEK_VIEW: "Week",
		DAY_VIEW: "Day",
		TRACKS_VIEW: "Tracks",
		HISTORY_VIEW: "History",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		rawState = { viewMode: "week" };
	});

	it.each([
		["year", "Year"],
		["month", "Month"],
		["week", "Week"],
		["day", "Day"],
		["tracks", "Tracks"],
		["history", "History"],
	])("returns description and icon for %s view", (viewMode, description) => {
		rawState = { viewMode };
		const section = getScheduleSection({ translations });
		expect(section.description).toBe(description);
		expect(section.Icon).toBeTruthy();
		expect(section.menuItems).toHaveLength(6);
	});

	it("returns empty description without icon for unknown view", () => {
		rawState = { viewMode: "unknown" };
		const section = getScheduleSection({ translations });
		expect(section.description).toBe("");
		expect(section.Icon).toBeUndefined();
	});

	it("updates ScheduleStore when menu items are clicked", () => {
		const section = getScheduleSection({ translations });
		const modes = ["year", "month", "week", "day", "tracks", "history"];

		section.menuItems.forEach((item, index) => {
			update.mockClear();
			const state = { viewMode: "old" };
			item.onClick();
			expect(update).toHaveBeenCalled();
			update.mock.calls[0][0](state);
			expect(state.viewMode).toBe(modes[index]);
		});
	});
});
