import { getResetSection } from "./Section.js";

describe("getResetSection", () => {
	it("returns change password when sectionIndex set", () => {
		expect(
			getResetSection({
				sectionIndex: 1,
				translations: { CHANGE_PASSWORD: "Change" },
			}),
		).toEqual({ name: "Change", tooltip: "Change" });
	});

	it("returns empty object otherwise", () => {
		expect(getResetSection({ translations: {} })).toEqual({});
	});
});
