import { act, fireEvent, render, screen } from "@testing-library/react";
import { useDateFormatter } from "@util/data/locale";
import { formatDuration } from "@util/data/string";
import TrackCard from "./Card.js";

jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest.fn(),
}));
jest.mock("@util/data/string", () => ({
	formatDuration: jest.fn(() => "00:01:30"),
}));
jest.mock("@util/data/color", () => ({
	getContrastColor: jest.fn(() => "#fff"),
}));
jest.mock("@widgets/Tooltip", () => ({ children }) => <>{children}</>);
jest.mock("@widgets/SessionIcon", () => ({ type }) => (
	<span data-testid={`type-${type}`} />
));
jest.mock("@widgets/Image", () => ({ path, onLoad, alt }) => (
	<button
		type="button"
		data-testid="image"
		data-path={path || ""}
		aria-label={alt || "image"}
		onClick={() => onLoad?.()}
	>
		img
	</button>
));
jest.mock("@ui/Typography", () => ({ children, className }) => (
	<span className={className}>{children}</span>
));

describe("TrackCard", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useDateFormatter.mockReturnValue({
			format: (date) =>
				`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const baseSession = {
		id: "1",
		name: "Session One",
		date: "2024-06-15",
		group: "alpha",
		color: "#123456",
		type: "audio",
		duration: 90,
		thumbnail: "thumb.jpg",
		position: 0,
	};

	it("renders session details and active/playing classes", () => {
		const { container } = render(
			<TrackCard
				session={baseSession}
				isActive
				isPlaying
				onSessionClick={jest.fn()}
			/>,
		);

		expect(screen.getByText("Session One")).toBeInTheDocument();
		expect(screen.getByText("alpha")).toBeInTheDocument();
		expect(screen.getByText("2024-6-15")).toBeInTheDocument();
		expect(screen.getByText("00:01:30")).toBeInTheDocument();
		expect(screen.getByTestId("type-audio")).toBeInTheDocument();
		expect(container.firstChild.className).toMatch(/active/);
		expect(container.firstChild.className).toMatch(/playing/);
	});

	it("invokes onSessionClick when the card is clicked", () => {
		const onSessionClick = jest.fn();
		const { container } = render(
			<TrackCard session={baseSession} onSessionClick={onSessionClick} />,
		);
		fireEvent.click(container.firstChild);
		expect(onSessionClick).toHaveBeenCalledWith(baseSession);
	});

	it("does nothing when onSessionClick is missing", () => {
		const { container } = render(<TrackCard session={baseSession} />);
		fireEvent.click(container.firstChild);
	});

	it("hides duration for images and zero/invalid durations", () => {
		const { rerender } = render(
			<TrackCard session={{ ...baseSession, type: "image", duration: 10 }} />,
		);
		expect(screen.queryByText("00:01:30")).not.toBeInTheDocument();

		rerender(<TrackCard session={{ ...baseSession, duration: 0 }} />);
		expect(formatDuration).not.toHaveBeenCalled();

		formatDuration.mockReturnValue("00:00:00");
		rerender(<TrackCard session={{ ...baseSession, duration: 5 }} />);
		expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
	});

	it("formats invalid dates as raw strings and empty for missing dates", () => {
		const { rerender } = render(
			<TrackCard session={{ ...baseSession, date: "not-a-date" }} />,
		);
		expect(screen.getByText("not-a-date")).toBeInTheDocument();

		rerender(<TrackCard session={{ ...baseSession, date: "" }} />);
		expect(screen.queryByText("2024-6-15")).not.toBeInTheDocument();

		rerender(<TrackCard session={{ ...baseSession, date: "2024-13-99" }} />);
	});

	it("shows progress bar when position is set", () => {
		const { container } = render(
			<TrackCard session={{ ...baseSession, position: 45, duration: 90 }} />,
		);
		const progress = container.querySelector("[class*='progressBar']");
		expect(progress).toBeTruthy();
		expect(progress.style.width).toBe("50%");
	});

	it("delays showing non-string thumbnails and resets on id change", () => {
		const { rerender } = render(
			<TrackCard session={{ ...baseSession, thumbnail: { pending: true } }} />,
		);
		expect(screen.getByTestId("image")).toHaveAttribute("data-path", "");

		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(screen.getByTestId("image")).toHaveAttribute(
			"data-path",
			"[object Object]",
		);

		rerender(
			<TrackCard
				session={{
					...baseSession,
					id: "2",
					thumbnail: "new.jpg",
					name: "Two",
				}}
			/>,
		);
		expect(screen.getByTestId("image")).toHaveAttribute("data-path", "new.jpg");
	});

	it("clears gradient after image load", () => {
		const { container } = render(<TrackCard session={baseSession} />);
		const inner = container.querySelector("[class*='cardInner']");
		expect(inner.style.background).toContain("linear-gradient");

		fireEvent.click(screen.getByTestId("image"));
		expect(inner.style.background).toBe("");
	});

	it("uses fallback color when session color is missing", () => {
		render(<TrackCard session={{ ...baseSession, color: undefined }} />);
		expect(screen.getByText("alpha")).toBeInTheDocument();
	});
});
