import { getSessionSection } from "./Section.js";

describe("getSessionSection", () => {
	it("builds label and tooltip from date and name", () => {
		expect(getSessionSection({ date: "2024-01-01", name: "Talk" })).toEqual({
			label: "2024-01-01 Talk",
			tooltip: "2024-01-01 Talk",
		});
	});
});
