import { render } from "@testing-library/react";
import { useFetch } from "@util/fetch";
import { useTranslations } from "@util/translations";
import Summary from "./index.js";

jest.mock("@util/fetch");
jest.mock("@util/translations");
jest.mock("@util/string", () => ({ preprocessMarkdown: jest.fn((s) => s) }));
jest.mock("react-markdown", () => ({ children }) => (
	<div data-testid="markdown">{children}</div>
));

describe("Summary Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ NO_SUMMARY: "No summary available" });
	});

	it("renders loading state", () => {
		useFetch.mockReturnValue([null, null, true]);
		const { container } = render(<Summary path="test" />);
		expect(
			container.querySelector(".MuiLinearProgress-root"),
		).toBeInTheDocument();
	});

	it("renders markdown content", () => {
		useFetch.mockReturnValue(["# Test Summary", null, false]);
		const { getByTestId } = render(<Summary path="test" />);
		expect(getByTestId("markdown")).toHaveTextContent("# Test Summary");
	});

	it("renders no summary message when content is missing", () => {
		useFetch.mockReturnValue([null, null, false]);
		const { getByText } = render(<Summary path="test" />);
		expect(getByText("No summary available")).toBeInTheDocument();
	});
});
