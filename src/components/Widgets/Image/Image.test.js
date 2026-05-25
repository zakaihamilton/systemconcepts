import { render, waitFor } from "@testing-library/react";
import { useFetchJSON } from "@util/api/fetch";
import ImageWidget from "./index.js";

jest.mock("@util/api/fetch");
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);

describe("Image Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders progress while loading from external source", () => {
		useFetchJSON.mockReturnValue([null, false, false]);
		const { getByTestId } = render(
			<ImageWidget path="wasabi/test.png" showProgress={true} />,
		);
		expect(getByTestId("progress")).toBeInTheDocument();
	});

	it("renders image when path is provided", async () => {
		useFetchJSON.mockReturnValue([
			{ path: "https://example.com/test.png" },
			false,
			false,
		]);
		const { getByRole } = render(
			<ImageWidget path="https://example.com/test.png" alt="Test Image" />,
		);
		await waitFor(() => {
			expect(getByRole("img")).toHaveAttribute(
				"src",
				"https://example.com/test.png",
			);
		});
	});

	it("renders alt text when path is missing", () => {
		const { getByText } = render(<ImageWidget alt="Alt Text" />);
		expect(getByText("Alt Text")).toBeInTheDocument();
	});
});
