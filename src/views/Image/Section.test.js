import { getImageSection } from "./Section.js";

describe("getImageSection", () => {
	it("returns translated label when provided", () => {
		expect(
			getImageSection({ label: "IMAGE", translations: { IMAGE: "Image" } }),
		).toEqual({ label: "Image" });
	});

	it("hides breadcrumbs without label", () => {
		expect(getImageSection({ translations: {} })).toEqual({
			breadcrumbs: false,
		});
	});
});
