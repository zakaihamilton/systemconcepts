import { getArticleSection } from "./Section.js";

describe("getArticleSection", () => {
	it("uses name or NEW_ARTICLE", () => {
		expect(
			getArticleSection({
				sectionIndex: 1,
				name: "Grace",
				translations: { NEW_ARTICLE: "New" },
			}),
		).toEqual({ name: "Grace" });
		expect(
			getArticleSection({
				sectionIndex: 1,
				translations: { NEW_ARTICLE: "New" },
			}),
		).toEqual({ name: "New" });
	});

	it("returns undefined without sectionIndex", () => {
		expect(getArticleSection({ translations: {} })).toBeUndefined();
	});
});
