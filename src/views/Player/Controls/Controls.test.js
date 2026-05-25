import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import Controls from "./index.js";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ direction: "ltr" }),
	},
}));
jest.mock("@util/hooks", () => ({
	usePageVisibility: jest.fn().mockReturnValue(true),
}));
jest.mock("@util/storage", () => ({
	useFile: jest.fn().mockReturnValue([{}, false, false, jest.fn()]),
}));
jest.mock("@util/mediaSession", () => ({
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
});
