import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useFetchJSON } from "@util/api/fetch";
import ImageWidget from "./index.js";

jest.mock("@util/api/fetch");
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);
jest.mock("@ui/Link", () => ({
	__esModule: true,
	default: ({ children, onClick, href, className, disabled, style }) => (
		<a
			href={href}
			onClick={onClick}
			className={className}
			aria-disabled={disabled}
			style={style}
			data-testid="link"
		>
			{children}
		</a>
	),
}));

describe("Image Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useFetchJSON.mockReturnValue([null, false, false]);
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

	it("handles load and error events and invokes onLoad", async () => {
		const onLoad = jest.fn();
		useFetchJSON.mockReturnValue([null, false, false]);
		render(
			<ImageWidget
				path="https://cdn/img.png"
				alt="pic"
				onLoad={onLoad}
				onClick={jest.fn()}
				href="#go"
				width={10}
				height={20}
				loading="lazy"
			/>,
		);
		const img = await screen.findByRole("img");
		fireEvent.load(img);
		expect(onLoad).toHaveBeenCalled();
		fireEvent.error(img);
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("shows a thumbnail until the main image loads", async () => {
		useFetchJSON.mockReturnValue([null, false, false]);
		render(
			<ImageWidget
				path="https://cdn/full.png"
				thumbnail="https://cdn/thumb.png"
				alt="both"
			/>,
		);
		await waitFor(() => {
			expect(screen.getAllByRole("img")).toHaveLength(2);
		});
	});

	it("treats aws/ paths without a leading slash as signed", () => {
		useFetchJSON.mockReturnValue([{ path: "https://signed" }, false, false]);
		render(<ImageWidget path="aws/file.png" alt="aws" />);
		expect(useFetchJSON).toHaveBeenCalledWith(
			"/api/player",
			expect.any(Object),
			["aws/file.png"],
			true,
		);
	});

	it("hides progress when showProgress is false", () => {
		useFetchJSON.mockReturnValue([null, false, false]);
		render(<ImageWidget path="wasabi/x.png" showProgress={false} />);
		expect(screen.queryByTestId("progress")).not.toBeInTheDocument();
	});

	it("detects already-complete cached images", async () => {
		useFetchJSON.mockReturnValue([null, false, false]);
		const onLoad = jest.fn();
		render(
			<ImageWidget
				path="https://cdn/cached.png"
				alt="cached"
				onLoad={onLoad}
			/>,
		);
		const img = await screen.findByRole("img");
		Object.defineProperty(img, "complete", { value: true });
		Object.defineProperty(img, "naturalHeight", { value: 10 });
		await act(async () => {
			fireEvent.load(img);
		});
		expect(onLoad).toHaveBeenCalled();
	});

	it("shows external boolean loading without a path", () => {
		render(<ImageWidget loading showProgress />);
		expect(screen.getByTestId("progress")).toBeInTheDocument();
	});

	it("clears image state when the effective path becomes empty", async () => {
		jest.useFakeTimers();
		useFetchJSON.mockReturnValue([null, false, false]);
		const { rerender } = render(
			<ImageWidget path="https://cdn/a.png" alt="swap" />,
		);
		await waitFor(() => {
			expect(screen.getByRole("img")).toBeInTheDocument();
		});
		rerender(<ImageWidget path="" alt="swap" />);
		await act(async () => {
			jest.runAllTimers();
		});
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		jest.useRealTimers();
	});

	it("hides thumbnail when it matches the effective path", async () => {
		useFetchJSON.mockReturnValue([null, false, false]);
		render(
			<ImageWidget
				path="https://cdn/same.png"
				thumbnail="https://cdn/same.png"
				alt="same"
			/>,
		);
		await waitFor(() => {
			expect(screen.getAllByRole("img")).toHaveLength(1);
		});
	});
});
