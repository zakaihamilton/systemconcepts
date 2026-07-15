import { act, fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import Controls from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ direction: "ltr" }),
	},
}));
jest.mock("@util/browser/hooks", () => ({
	usePageVisibility: jest.fn().mockReturnValue(true),
}));
jest.mock("@util/storage/storage", () => ({
	useFile: jest.fn().mockReturnValue([{}, false, false, jest.fn()]),
}));
jest.mock("@util/browser/mediaSession", () => ({
	useMediaSession: jest.fn(),
}));
jest.mock("../Button", () => ({ name, onClick, icon }) => (
	<button data-testid={`button-${name}`} onClick={onClick}>
		{icon}
	</button>
));

describe("Controls Component", () => {
	let mockPlayer;

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			TIME_LEFT: "Time left",
			SEEK: "Seek",
			REPLAY: "Replay",
			FORWARD: "Forward",
			RELOAD: "Reload",
			PLAY: "Play",
			PAUSE: "Pause",
			STOP: "Stop",
		});

		mockPlayer = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			play: jest.fn().mockResolvedValue({}),
			pause: jest.fn(),
			load: jest.fn(),
			currentTime: 0,
			duration: 100,
			paused: true,
			readyState: 4,
		};
	});

	it("renders playback buttons", () => {
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		expect(getByTestId("button-Play")).toBeInTheDocument();
		expect(getByTestId("button-Stop")).toBeInTheDocument();
	});

	it("calls play when play button is clicked", () => {
		const { getByTestId, getByRole } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		fireEvent.click(getByTestId("button-Play"));
		expect(mockPlayer.play).toHaveBeenCalled();
		expect(getByRole("progressbar")).toHaveClass("loadingIndicator");
	});

	it("calls pause when pause button is clicked", () => {
		mockPlayer.paused = false;
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		fireEvent.click(getByTestId("button-Pause"));
		expect(mockPlayer.pause).toHaveBeenCalled();
	});

	it("renders loading button when renewing is true", () => {
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			PLAY: "Play",
			STOP: "Stop",
		});
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} renewing={true} />,
		);
		expect(getByTestId("button-Loading")).toBeInTheDocument();
	});

	it("renders loading button when duration is NaN", () => {
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			PLAY: "Play",
			STOP: "Stop",
		});
		mockPlayer.duration = NaN;
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		expect(getByTestId("button-Loading")).toBeInTheDocument();
	});

	it("renders loading button when loadstart event is triggered and switches back on playing", () => {
		useTranslations.mockReturnValue({
			LOADING: "Loading",
			PLAY: "Play",
			PAUSE: "Pause",
			STOP: "Stop",
		});
		const eventListeners = {};
		mockPlayer.addEventListener.mockImplementation((event, cb) => {
			eventListeners[event] = cb;
		});

		const { getByTestId, getByRole } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);

		// Trigger loadstart
		act(() => {
			eventListeners["loadstart"]();
		});

		// Now it should show Loading button
		expect(getByTestId("button-Loading")).toBeInTheDocument();
		const spinner = getByRole("progressbar");

		// Readiness can arrive before playback starts; do not reset the spinner.
		act(() => {
			eventListeners["canplay"]();
		});
		expect(getByTestId("button-Loading")).toBeInTheDocument();
		expect(getByRole("progressbar")).toBe(spinner);

		// The browser flips paused before playback is fully underway. Keep the
		// same button and spinner mounted through that state change.
		mockPlayer.paused = false;
		act(() => {
			eventListeners["play"]();
		});
		expect(getByRole("progressbar")).toBe(spinner);

		// Trigger playing
		act(() => {
			eventListeners["playing"]();
		});

		// Now it should show Pause once playback has started.
		expect(getByTestId("button-Pause")).toBeInTheDocument();
	});
});
