import { getColorName, getContrastColor, hexToRgb } from "./color";

describe("hexToRgb", () => {
	it("expands a 3-character shorthand hex string", () => {
		expect(hexToRgb("abc")).toEqual({ r: 170, g: 187, b: 204 });
	});

	it("parses a 6-character hex string", () => {
		expect(hexToRgb("336699")).toEqual({ r: 51, g: 102, b: 153 });
	});

	it("strips a leading # before parsing", () => {
		expect(hexToRgb("#336699")).toEqual({ r: 51, g: 102, b: 153 });
	});
});

describe("getColorName", () => {
	it("returns the NONE translation when hex is falsy", () => {
		const translations = { NONE: "None" };
		expect(getColorName(null, translations)).toBe("None");
		expect(getColorName("", translations)).toBe("None");
	});

	it("returns the exact name for a color that is in the list", () => {
		expect(getColorName("#000000", {})).toBe("Black");
	});

	it("returns the closest color name for a color not in the list", () => {
		expect(getColorName("#FF0001", {})).toBe("Red");
	});
});

describe("getContrastColor", () => {
	it("returns inherit when hex is falsy", () => {
		expect(getContrastColor(null)).toBe("inherit");
		expect(getContrastColor("")).toBe("inherit");
	});

	it("returns black for a light color", () => {
		expect(getContrastColor("#ffffff")).toBe("black");
	});

	it("returns white for a dark color", () => {
		expect(getContrastColor("#000000")).toBe("white");
	});
});
