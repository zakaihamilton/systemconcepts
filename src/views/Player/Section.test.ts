import { getPlayerSection } from "./Section";

describe("getPlayerSection", () => {
	it("hides breadcrumbs", () => {
		expect(getPlayerSection({})).toEqual({ breadcrumbs: false });
	});
});
