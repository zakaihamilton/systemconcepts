import { render, waitFor } from "@testing-library/react";
import { useLanguage } from "@util/domain/language";
import { useTranslations } from "./translations";

jest.mock("@util/domain/language", () => ({
	useLanguage: jest.fn(),
}));

jest.mock("@data/languages", () => ({
	__esModule: true,
	default: [
		{
			id: "eng",
			translations: [
				{ id: "HELLO", value: "Hello" },
				{ id: "BYE", value: "Bye" },
			],
		},
		{
			id: "heb",
			translations: [{ id: "HELLO", value: "שלום" }],
		},
		{
			id: "empty",
		},
	],
}));

function renderHook(hook) {
	let result;
	function Wrapper() {
		result = hook();
		return null;
	}
	render(<Wrapper />);
	return () => result;
}

describe("useTranslations", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("builds a translations map keyed by id for the current language", async () => {
		useLanguage.mockReturnValue("eng");
		const getResult = renderHook(useTranslations);
		await waitFor(() =>
			expect(getResult()).toEqual({ HELLO: "Hello", BYE: "Bye" }),
		);
	});

	it("returns a different map when the language changes", async () => {
		useLanguage.mockReturnValue("heb");
		const getResult = renderHook(useTranslations);
		await waitFor(() => expect(getResult()).toEqual({ HELLO: "שלום" }));
	});

	it("returns an empty object when the language has no translations defined", async () => {
		useLanguage.mockReturnValue("empty");
		const getResult = renderHook(useTranslations);
		await waitFor(() => expect(getResult()).toEqual({}));
	});

	it("returns an empty object when the language is not found", async () => {
		useLanguage.mockReturnValue("unknown");
		const getResult = renderHook(useTranslations);
		await waitFor(() => expect(getResult()).toEqual({}));
	});
});
