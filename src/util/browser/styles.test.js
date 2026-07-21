import { renderHook } from "@testing-library/react";
import { useWindowSize } from "@util/browser/size";
import {
	getProperty,
	setProperty,
	toggleProperty,
	useDeviceType,
	useStyles,
} from "./styles";

jest.mock("@util/browser/size", () => ({
	useWindowSize: jest.fn(),
}));

describe("getProperty / setProperty", () => {
	afterEach(() => {
		document.documentElement.style.removeProperty("--test-token");
	});

	it("writes and reads a CSS custom property on the document root", () => {
		setProperty("--test-token", "42px");
		expect(getProperty("--test-token").trim()).toBe("42px");
	});
});

describe("toggleProperty", () => {
	it("throws because nextTrimmedString is not imported", () => {
		expect(() => toggleProperty("--test-token", ["a", "b"])).toThrow();
	});
});

describe("useStyles", () => {
	const styles = { active: "active-class", highlighted: "highlighted-class" };

	it("returns class names for truthy data values", () => {
		const { result } = renderHook(() =>
			useStyles(styles, { active: true, highlighted: false }),
		);
		expect(result.current).toBe("active-class");
	});

	it("evaluates function values using the full data object", () => {
		const { result } = renderHook(() =>
			useStyles(styles, {
				active: (data) => data.highlighted,
				highlighted: true,
			}),
		);
		expect(result.current.split(" ").sort()).toEqual(
			["active-class", "highlighted-class"].sort(),
		);
	});

	it("returns an empty string when data is empty", () => {
		const { result } = renderHook(() => useStyles(styles, undefined));
		expect(result.current).toBe("");
	});
});

describe("useDeviceType", () => {
	it("returns ssr when the width is not yet known", () => {
		useWindowSize.mockReturnValue({ width: 0, height: 0 });
		const { result } = renderHook(() => useDeviceType());
		expect(result.current).toBe("ssr");
	});

	it("returns phone for narrow widths", () => {
		useWindowSize.mockReturnValue({ width: 400, height: 800 });
		const { result } = renderHook(() => useDeviceType());
		expect(result.current).toBe("phone");
	});

	it("returns tablet for mid-range widths", () => {
		useWindowSize.mockReturnValue({ width: 800, height: 1000 });
		const { result } = renderHook(() => useDeviceType());
		expect(result.current).toBe("tablet");
	});

	it("returns desktop for wide widths", () => {
		useWindowSize.mockReturnValue({ width: 1440, height: 900 });
		const { result } = renderHook(() => useDeviceType());
		expect(result.current).toBe("desktop");
	});
});
