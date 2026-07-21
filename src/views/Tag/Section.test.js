import { getTagSection } from "./Section.js";

describe("getTagSection", () => {
	it("uses path or NEW_TAG", () => {
		expect(
			getTagSection({
				sectionIndex: 1,
				path: "grace",
				translations: { NEW_TAG: "New" },
			}),
		).toEqual({ name: "grace" });
		expect(
			getTagSection({
				sectionIndex: 1,
				translations: { NEW_TAG: "New" },
			}),
		).toEqual({ name: "New" });
	});

	it("returns undefined without sectionIndex", () => {
		expect(getTagSection({ translations: {} })).toBeUndefined();
	});
});
