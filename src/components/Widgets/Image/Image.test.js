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

	it("requests a signed player URL for AWS images", () => {
		useFetchJSON.mockReturnValue([null, false, false]);

		render(
			<ImageWidget
				path="/aws/sessions/will/2026/2026-06-30 Beastly.png"
				alt="Beastly"
			/>,
		);

		expect(useFetchJSON).toHaveBeenCalledWith(
			"/api/player",
			expect.objectContaining({
				headers: {
					path: encodeURIComponent(
						"/aws/sessions/will/2026/2026-06-30 Beastly.png",
					),
				},
			}),
			["/aws/sessions/will/2026/2026-06-30 Beastly.png"],
			true,
		);
	});

	it("does not render alt text as visible fallback content", () => {
		const { queryByText } = render(<ImageWidget alt="Post War Depression" />);
		expect(queryByText("Post War Depression")).not.toBeInTheDocument();
	});
});
