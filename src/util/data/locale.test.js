import { renderHook } from "@testing-library/react";
import { useRegionalLocale } from "@util/domain/language";
import { useDateFormatter, useLocale } from "./locale";

jest.mock("@util/domain/language", () => ({
	useRegionalLocale: jest.fn(),
}));

describe("useLocale", () => {
	it("returns the regional locale", () => {
		useRegionalLocale.mockReturnValue("fr-FR");
		const { result } = renderHook(() => useLocale());
		expect(result.current).toBe("fr-FR");
	});
});

describe("useDateFormatter", () => {
	beforeEach(() => {
		useRegionalLocale.mockReturnValue("en-US");
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("formats a date using the explicit locale", () => {
		const { result } = renderHook(() =>
			useDateFormatter(
				{ year: "numeric", month: "2-digit", day: "2-digit" },
				"en-US",
			),
		);
		expect(result.current.format(new Date(2024, 0, 15))).toBe("01/15/2024");
	});

	it("falls back to the app locale when none is provided", () => {
		useRegionalLocale.mockReturnValue("en-GB");
		const { result } = renderHook(() =>
			useDateFormatter({ year: "numeric", month: "2-digit", day: "2-digit" }),
		);
		expect(result.current.format(new Date(2024, 0, 15))).toBe("15/01/2024");
	});

	it("returns formatted parts", () => {
		const { result } = renderHook(() =>
			useDateFormatter({ year: "numeric", month: "long", day: "numeric" }),
		);
		const parts = result.current.formatToParts(new Date(2024, 0, 15));
		expect(parts.some((part) => part.type === "month")).toBe(true);
	});

	it("formats a date with an ordinal day suffix for English locales", () => {
		const { result } = renderHook(() =>
			useDateFormatter({ day: "numeric" }, "en-US"),
		);
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 1))).toBe("1st");
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 2))).toBe("2nd");
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 3))).toBe("3rd");
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 11))).toBe(
			"11th",
		);
	});

	it("does not add an ordinal suffix for non-English locales", () => {
		const { result } = renderHook(() =>
			useDateFormatter({ day: "numeric" }, "fr-FR"),
		);
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 1))).toBe("1");
	});

	it("returns empty fallbacks when formatting an invalid date", () => {
		const { result } = renderHook(() =>
			useDateFormatter({ day: "numeric" }, "en-US"),
		);
		const invalidDate = new Date("invalid");
		expect(result.current.format(invalidDate)).toBe("");
		expect(result.current.formatToParts(invalidDate)).toEqual([]);
		expect(result.current.formatWithOrdinal(invalidDate)).toBe("");
	});

	it("formats teen ordinals using the 11-13 exception rule", () => {
		const { result } = renderHook(() =>
			useDateFormatter({ day: "numeric" }, "en-US"),
		);
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 21))).toBe(
			"21st",
		);
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 22))).toBe(
			"22nd",
		);
		expect(result.current.formatWithOrdinal(new Date(2024, 0, 23))).toBe(
			"23rd",
		);
	});

	it("falls back to en-US when no locale is configured", () => {
		useRegionalLocale.mockReturnValue(null);
		const { result } = renderHook(() =>
			useDateFormatter({ year: "numeric", month: "2-digit", day: "2-digit" }),
		);
		expect(result.current.format(new Date(2024, 0, 15))).toBe("01/15/2024");
	});
});
