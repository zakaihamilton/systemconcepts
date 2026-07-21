import { getTranslationsSection } from "./Section.js";

jest.mock("@data/languages", () => [
	{ id: "eng", name: "English" },
	{ id: "heb", name: "Hebrew" },
]);

describe("getTranslationsSection", () => {
	it("returns language name", () => {
		expect(getTranslationsSection({ language: "heb" })).toEqual({
			name: "Hebrew",
		});
	});

	it("returns undefined without language", () => {
		expect(getTranslationsSection({})).toBeUndefined();
	});
});
