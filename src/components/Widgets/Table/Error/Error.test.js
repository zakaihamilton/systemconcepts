import { render, screen } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import ErrorComponent from "./Error.js";

jest.mock("@util/domain/translations");

describe("Error Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			ERROR: "Translated Error Title",
			MOCK_TRANSLATED_ERROR: "This is a translated error message",
		});
	});

	it("renders string error message and uses translation if available", () => {
		render(<ErrorComponent error="MOCK_TRANSLATED_ERROR" />);
		expect(
			screen.getByText("This is a translated error message"),
		).toBeInTheDocument();
	});

	it("falls back to raw error message if no translation is available", () => {
		render(<ErrorComponent error="UNTRANSLATED_ERROR_MSG" />);
		expect(screen.getByText("UNTRANSLATED_ERROR_MSG")).toBeInTheDocument();
	});

	it("renders error object message", () => {
		const errorObj = { message: "MOCK_TRANSLATED_ERROR" };
		render(<ErrorComponent error={errorObj} />);
		expect(
			screen.getByText("This is a translated error message"),
		).toBeInTheDocument();
	});
});
