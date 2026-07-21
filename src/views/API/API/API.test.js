import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
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
			expect(
				getByText(/fetch\("http:\/\/localhost\/api\/sessions/),
			).toBeInTheDocument();
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

	it("denies access when rssToken is missing", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({
			id: "testuser",
			role: "user",
		});

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Acess Denied")).toBeInTheDocument();
		});
	});

	it("keeps loading when user fetch fails", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockRejectedValue(new Error("network"));

		const { getByTestId } = render(<API />);
		expect(getByTestId("page-load")).toBeInTheDocument();
		await waitFor(() => {
			expect(fetchJSON).toHaveBeenCalled();
		});
		expect(getByTestId("page-load")).toBeInTheDocument();
	});

	it("allows admin role access", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "admin";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({
			id: "admin",
			rssToken: "tok",
			role: "admin",
		});

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Sessions API")).toBeInTheDocument();
		});
	});

	it("denies access when user fetch returns err", async () => {
		Cookies.get.mockImplementation((key) => {
			if (key === "id") return "testuser";
			if (key === "hash") return "testhash";
			return null;
		});
		fetchJSON.mockResolvedValue({ err: "not found" });

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Acess Denied")).toBeInTheDocument();
		});
	});

	it("renders query parameters table and JSON schema sections", async () => {
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

		const { getAllByText, getByText } = render(<API />);
		await waitFor(() => {
			expect(getAllByText("Query Parameters").length).toBeGreaterThan(0);
			expect(getByText("group")).toBeInTheDocument();
			expect(getByText("tag")).toBeInTheDocument();
			expect(getAllByText("JSON Response Schema").length).toBeGreaterThan(0);
			expect(getByText(/SessionsResponse/)).toBeInTheDocument();
		});
	});

	it("copies code example when Copy Code is clicked", async () => {
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
			expect(getByText("Copy Code")).toBeInTheDocument();
		});

		fireEvent.click(getByText("Copy Code"));
		expect(mockWriteText).toHaveBeenCalledWith(
			expect.stringContaining('curl -X GET "http://localhost/api/sessions'),
		);
	});

	it("shows copied feedback after copying URL then resets", async () => {
		jest.useFakeTimers();
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
		useTranslations.mockReturnValue({
			...mockTranslations,
			API_COPIED: "Copied!",
			API_COPY_CODE: "Copy Code",
			API_COPIED_CODE: "Copied Code!",
		});

		const mockWriteText = jest.fn();
		Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Copy URL")).toBeInTheDocument();
		});

		fireEvent.click(getByText("Copy URL"));
		expect(getByText("Copied!")).toBeInTheDocument();

		act(() => {
			jest.advanceTimersByTime(2000);
		});
		expect(getByText("Copy URL")).toBeInTheDocument();
		jest.useRealTimers();
	});

	it("pins section nav on scroll and updates active section", async () => {
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

		const scrollParent = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		};
		jest.spyOn(document, "querySelector").mockReturnValue(scrollParent);

		const originalGetBoundingClientRect =
			HTMLElement.prototype.getBoundingClientRect;
		HTMLElement.prototype.getBoundingClientRect = jest.fn(function () {
			if (this.id === "api-sessions-parameters") {
				return { top: 90, bottom: 200, left: 0, width: 400, height: 40 };
			}
			if (this.id === "api-sessions-endpoint") {
				return { top: 200, bottom: 300, left: 0, width: 400, height: 40 };
			}
			return { top: 0, bottom: 50, left: 10, width: 300, height: 40 };
		});

		global.ResizeObserver = jest.fn().mockImplementation(() => ({
			observe: jest.fn(),
			disconnect: jest.fn(),
		}));

		const { getByRole } = render(<API />);
		await waitFor(() => {
			expect(getByRole("button", { name: "Endpoint" })).toBeInTheDocument();
		});

		fireEvent.scroll(window);
		await waitFor(() => {
			expect(getByRole("button", { name: "Query Parameters" })).toHaveAttribute(
				"aria-current",
				"true",
			);
		});

		fireEvent(window, new Event("transitionrun", { bubbles: true }));
		fireEvent(window, new Event("transitionstart", { bubbles: true }));
		fireEvent(window, new Event("resize"));

		HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
		document.querySelector.mockRestore();
	});

	it("renders fixed section nav in a portal when pinned", async () => {
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

		const scrollParent = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		};
		jest.spyOn(document, "querySelector").mockReturnValue(scrollParent);

		const originalGetBoundingClientRect =
			HTMLElement.prototype.getBoundingClientRect;
		HTMLElement.prototype.getBoundingClientRect = jest.fn(function () {
			return { top: 0, bottom: 48, left: 12, width: 320, height: 48 };
		});

		global.ResizeObserver = jest.fn().mockImplementation(() => ({
			observe: jest.fn(),
			disconnect: jest.fn(),
		}));

		render(<API />);
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Endpoint" }),
			).toBeInTheDocument();
		});

		fireEvent.scroll(window);
		await waitFor(() => {
			expect(
				document.body.querySelector('[class*="sectionNavFixed"]'),
			).toBeTruthy();
		});

		HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
		document.querySelector.mockRestore();
	});

	it("shows copied feedback after copying code", async () => {
		jest.useFakeTimers();
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
		useTranslations.mockReturnValue({
			...mockTranslations,
			API_COPY_CODE: "Copy Code",
			API_COPIED_CODE: "Copied Code!",
		});

		const mockWriteText = jest.fn();
		Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

		const { getByText } = render(<API />);
		await waitFor(() => {
			expect(getByText("Copy Code")).toBeInTheDocument();
		});

		fireEvent.click(getByText("Copy Code"));
		expect(getByText("Copied Code!")).toBeInTheDocument();

		act(() => {
			jest.advanceTimersByTime(2000);
		});
		expect(getByText("Copy Code")).toBeInTheDocument();
		jest.useRealTimers();
	});
});
