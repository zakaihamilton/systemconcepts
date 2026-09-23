import { getUserSection } from "./Section";

describe("getUserSection", () => {
	it("returns name when sectionIndex set", () => {
		expect(getUserSection({ sectionIndex: 1, name: "Ada" })).toEqual({
			name: "Ada",
		});
	});

	it("returns undefined without sectionIndex", () => {
		expect(getUserSection({ name: "Ada" })).toBeUndefined();
	});
});
