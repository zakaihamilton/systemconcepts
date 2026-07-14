import { fireEvent, render, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Podcast from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/fetch");
jest.mock("js-cookie");

describe("Podcast View", () => {
	const mockTranslations = {
		PODCAST: "Podcast",
		PODCAST_FEED: "Podcast Feed",
		PODCAST_FEED_DESCRIPTION: "Description",
		COPY_URL: "Copy URL",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		Cookies.get.mockReturnValue(null);
		// Mock window.location.origin
		delete window.location;
		window.location = { origin: "http://localhost" };
	});

	it("renders nothing if not signed in", () => {
		const { container } = render(<Podcast />);
		expect(container.firstChild).toBeNull();
	});

	it("renders podcast feed when signed in and user has rssToken", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({
			id: "testuser",
			rssToken: "token123",
			role: "user",
		});

		const { getByText } = render(<Podcast />);

		await waitFor(() => {
			expect(getByText("Podcast Feed")).toBeInTheDocument();
			expect(
				getByText("http://localhost/api/rss?id=testuser&token=token123"),
			).toBeInTheDocument();
		});
	});

	it("copies URL to clipboard when Copy URL is clicked", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({
			id: "testuser",
			rssToken: "token123",
			role: "user",
		});

		// Mock navigator.clipboard.writeText
		const mockWriteText = jest.fn();
		Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

		const { getByText } = render(<Podcast />);

		await waitFor(() => {
			fireEvent.click(getByText("Copy URL"));
			expect(mockWriteText).toHaveBeenCalledWith(
				"http://localhost/api/rss?id=testuser&token=token123",
			);
		});
	});
});
