import { renderHook } from "@testing-library/react";
import { useLanguage } from "@util/domain/language";
import { useDirection } from "./direction";

jest.mock("@util/domain/language", () => ({
	useLanguage: jest.fn(),
}));

jest.mock("@data/languages", () => [
	{ id: "eng", direction: "ltr" },
	{ id: "heb", direction: "rtl" },
]);

describe("useDirection", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it("returns rtl for a right-to-left language", () => {
		asMock(useLanguage).mockReturnValue("heb");
		const { result } = renderHook(() => useDirection());
		expect(result.current).toBe("rtl");
	});

	it("returns ltr for a left-to-right language", () => {
		asMock(useLanguage).mockReturnValue("eng");
		const { result } = renderHook(() => useDirection());
		expect(result.current).toBe("ltr");
	});

	it("returns undefined when the language is not found", () => {
		asMock(useLanguage).mockReturnValue("unknown");
		const { result } = renderHook(() => useDirection());
		expect(result.current).toBeUndefined();
	});
});
