import { getSessionsSection } from "./Section.js";

const update = jest.fn();
let rawState = { viewMode: "list" };

jest.mock("@util/domain/sessions", () => ({
	SessionsStore: {
		getRawState: () => rawState,
		update: (...args) => update(...args),
	},
}));

describe("getSessionsSection", () => {
	const translations = {
		LIST_VIEW: "List",
		TABLE_VIEW: "Table",
		GRID_VIEW: "Grid",
		TREE_VIEW: "Tree",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		rawState = { viewMode: "list" };
	});

	it.each([
		["list", "List"],
		["table", "Table"],
		["grid", "Grid"],
		["tree", "Tree"],
	])("returns description and icon for %s view", (viewMode, description) => {
		rawState = { viewMode };
		const section = getSessionsSection({ translations });
		expect(section.description).toBe(description);
		expect(section.Icon).toBeTruthy();
		expect(section.menuItems).toHaveLength(4);
	});

	it("returns empty description without icon for unknown view", () => {
		rawState = { viewMode: "unknown" };
		const section = getSessionsSection({ translations });
		expect(section.description).toBe("");
		expect(section.Icon).toBeUndefined();
	});

	it("updates SessionsStore when menu items are clicked", () => {
		const section = getSessionsSection({ translations });
		const modes = ["list", "table", "grid", "tree"];

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
