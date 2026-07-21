import { getTypeSection } from "./Section.js";

describe("getTypeSection", () => {
	it("uses path or NEW_TYPE", () => {
		expect(
			getTypeSection({
				sectionIndex: 1,
				path: "audio",
				translations: { NEW_TYPE: "New" },
			}),
		).toEqual({ name: "audio" });
		expect(
			getTypeSection({ sectionIndex: 1, translations: { NEW_TYPE: "New" } }),
		).toEqual({ name: "New" });
	});

	it("returns undefined without sectionIndex", () => {
		expect(getTypeSection({ translations: {} })).toBeUndefined();
	});
});
