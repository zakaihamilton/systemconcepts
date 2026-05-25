import { fireEvent, render, waitFor } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import API from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@util/api/fetch");
jest.mock("js-cookie");
jest.mock("@components/PageLoad", () => {
	return function MockPageLoad() {
		return <div data-testid="page-load">Loading...</div>;
	};
});

describe("API View", () => {
	const mockTranslations = {
		API: "API",
		API_FEED: "JSON API Feed",
		API_FEED_DESCRIPTION: "Retrieve all sessions in JSON format.",
		API_DOCUMENTATION: "API Documentation & Examples",
		COPY_URL: "Copy URL",
		ACCESS_DENIED: "Acess Denied",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue(mockTranslations);
		Cookies.get.mockReturnValue(null);
	});

	it("renders nothing if not signed in", () => {
		const { container } = render(<API />);
		expect(container.firstChild).toBeNull();
	});

	it("renders loading indicator while fetching user data", () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockReturnValue(new Promise(() => {})); // Never resolves

		const { getByTestId } = render(<API />);
		expect(getByTestId("page-load")).toBeInTheDocument();
	});

	it("renders access denied state for visitor role", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "visitoruser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({
			id: "visitoruser",
			role: "visitor",
		});

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Acess Denied")).toBeInTheDocument();
		});
	});

	it("renders API documentation when signed in and user has rssToken", async () => {
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

		const { getByText } = render(<API />);

		await waitFor(() => {
			expect(getByText("API")).toBeInTheDocument();
			expect(getByText("Sessions API")).toBeInTheDocument();
			expect(
				getByText("http://localhost/api/sessions?id=testuser&token=token123"),
			).toBeInTheDocument();
		});
	});

	it("copies API URL to clipboard when Copy URL is clicked", async () => {
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

		const mockWriteText = jest.fn();
		Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

		const { getByText } = render(<API />);

		await waitFor(() => {
			fireEvent.click(getByText("Copy URL"));
			expect(mockWriteText).toHaveBeenCalledWith(
				"http://localhost/api/sessions?id=testuser&token=token123",
			);
		});
	});

	it("switches tabs when tab buttons are clicked", async () => {
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

		const { getByText } = render(<API />);

		await waitFor(() => {
			expect(getByText("cURL")).toBeInTheDocument();
		});

		// Switch to JavaScript Tab
		fireEvent.click(getByText("JavaScript (Fetch)"));
		await waitFor(() => {
			expect(getByText(/fetch\("http:\/\/localhost\/api\/sessions/)).toBeInTheDocument();
		});

		// Switch to Python Tab
		fireEvent.click(getByText("Python"));
		await waitFor(() => {
			expect(getByText(/requests\.get\(url/)).toBeInTheDocument();
		});
	});

	it("jumps to sessions API sections without changing the route hash", async () => {
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

		const scrollIntoView = jest.fn();
		window.location.hash = "#api";
		HTMLElement.prototype.scrollIntoView = scrollIntoView;
		const { getByRole } = render(<API />);

		await waitFor(() => {
			expect(getByRole("button", { name: "Endpoint" })).toBeInTheDocument();
		});

		fireEvent.click(getByRole("button", { name: "Query Parameters" }));

		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "start",
		});
		expect(getByRole("button", { name: "Query Parameters" })).toHaveAttribute(
			"aria-current",
			"true",
		);
		expect(window.location.hash).toBe("#api");
	});
});
