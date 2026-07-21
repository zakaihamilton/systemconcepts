import {
	getContrastRatio,
	getSessionTextColor,
	hexToRgb,
	mixColors,
	useSessionTextColor,
} from "./colors";

describe("hexToRgb", () => {
	it("returns null for a falsy value", () => {
		expect(hexToRgb(null)).toBeNull();
		expect(hexToRgb("")).toBeNull();
	});

	it("returns null for an invalid hex string", () => {
		expect(hexToRgb("not-a-color")).toBeNull();
	});

	it("returns null for a 3-character shorthand hex string", () => {
		expect(hexToRgb("#fff")).toBeNull();
	});

	it("parses a hex color with a leading #", () => {
		expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
	});

	it("parses a hex color without a leading #", () => {
		expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
	});
});

describe("getContrastRatio", () => {
	it("returns the maximum ratio for hex black and white", () => {
		expect(getContrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
	});

	it("supports rgb() strings", () => {
		expect(getContrastRatio("rgb(255, 255, 255)", "rgb(0, 0, 0)")).toBeCloseTo(
			21,
			5,
		);
	});

	it("returns 1 when the first color cannot be parsed", () => {
		expect(getContrastRatio(null, "#000000")).toBe(1);
	});

	it("returns 1 when the second color cannot be parsed", () => {
		expect(getContrastRatio("#ffffff", "not-a-color")).toBe(1);
	});
});

describe("mixColors", () => {
	it("mixes two hex colors by weight", () => {
		expect(mixColors("#ffffff", "#000000", 0.5)).toBe("rgb(128, 128, 128)");
	});

	it("weighs more heavily toward the first color as weight increases", () => {
		expect(mixColors("#000000", "#ffffff", 0.3)).toBe("rgb(179, 179, 179)");
	});

	it("returns color1 unchanged when a color is invalid", () => {
		expect(mixColors("not-a-color", "#000000", 0.5)).toBe("not-a-color");
	});
});

describe("useSessionTextColor", () => {
	let getComputedStyleSpy;

	beforeEach(() => {
		getComputedStyleSpy = jest
			.spyOn(window, "getComputedStyle")
			.mockReturnValue({
				getPropertyValue: (prop) => {
					if (prop === "--main-background") return "#ffffff";
					if (prop === "--text-color") return "#123456";
					return "";
				},
			});
	});

	afterEach(() => {
		getComputedStyleSpy.mockRestore();
	});

	it("returns the computed text color when there is no session color", () => {
		expect(useSessionTextColor(null)).toBe("#123456");
	});

	it("returns black when the mixed background is light", () => {
		expect(useSessionTextColor("#000000")).toBe("#000000");
	});

	it("returns white when the mixed background is dark", () => {
		getComputedStyleSpy.mockReturnValue({
			getPropertyValue: (prop) => {
				if (prop === "--main-background") return "#000000";
				return "";
			},
		});
		expect(useSessionTextColor("#ffffff")).toBe("#ffffff");
	});
});

describe("getSessionTextColor", () => {
	it("uses the theme's text color when there is no session color", () => {
		const theme = {
			palette: {
				text: { primary: "#abcdef" },
				background: { default: "#ffffff" },
			},
		};
		expect(getSessionTextColor(null, theme)).toBe("#abcdef");
	});

	it("falls back to the computed text color when no theme is provided", () => {
		const getComputedStyleSpy = jest
			.spyOn(window, "getComputedStyle")
			.mockReturnValue({
				getPropertyValue: (prop) => {
					if (prop === "--text-color") return "#654321";
					return "";
				},
			});
		expect(getSessionTextColor(null, undefined)).toBe("#654321");
		getComputedStyleSpy.mockRestore();
	});

	it("computes a contrasting color using the theme's background", () => {
		const theme = { palette: { background: { default: "#ffffff" } } };
		expect(getSessionTextColor("#000000", theme)).toBe("#000000");
	});

	it("falls back to the computed background when the theme has none", () => {
		const getComputedStyleSpy = jest
			.spyOn(window, "getComputedStyle")
			.mockReturnValue({
				getPropertyValue: (prop) => {
					if (prop === "--main-background") return "#ffffff";
					return "";
				},
			});
		expect(getSessionTextColor("#000000", {})).toBe("#000000");
		getComputedStyleSpy.mockRestore();
	});
});
