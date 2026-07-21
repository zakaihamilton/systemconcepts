import { getPlayerSection } from "./Section.js";

describe("getPlayerSection", () => {
	it("hides breadcrumbs", () => {
		expect(getPlayerSection({})).toEqual({ breadcrumbs: false });
	});
});
