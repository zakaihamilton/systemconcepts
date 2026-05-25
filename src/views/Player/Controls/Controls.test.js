import { fireEvent, render, act } from "@testing-library/react";
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
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		fireEvent.click(getByTestId("button-Play"));
		expect(mockPlayer.play).toHaveBeenCalled();
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

		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);

		// Trigger loadstart
		act(() => {
			eventListeners["loadstart"]();
		});

		// Now it should show Loading button
		expect(getByTestId("button-Loading")).toBeInTheDocument();

		// Trigger playing
		act(() => {
			eventListeners["playing"]();
		});

		// Now it should show Play button again since player.paused is true
		expect(getByTestId("button-Play")).toBeInTheDocument();
	});
});
