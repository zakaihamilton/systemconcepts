import { MainStore } from "@components/Main";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { usePageVisibility } from "@util/browser/hooks";
import { useTranslations } from "@util/domain/translations";
import { useFile } from "@util/storage/storage";
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
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), error: jest.fn() },
}));
jest.mock("../Button", () => ({ name, onClick, icon }) => (
	<button data-testid={`button-${name}`} onClick={onClick}>
		{icon}
	</button>
));

describe("Controls Component", () => {
	let mockPlayer;
	let eventListeners;
	let setMetadata;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
		eventListeners = {};
		setMetadata = jest.fn();
		useTranslations.mockReturnValue({
			TIME_LEFT: "Time left",
			SEEK: "Seek",
			REPLAY: "Replay",
			FORWARD: "Forward",
			RELOAD: "Reload",
			PLAY: "Play",
			PAUSE: "Pause",
			STOP: "Stop",
			LOADING: "Loading",
			PLAYING_ERROR: "Playback error",
		});
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		usePageVisibility.mockReturnValue(true);
		useFile.mockReturnValue([{}, false, false, setMetadata]);

		mockPlayer = {
			addEventListener: jest.fn((event, cb) => {
				eventListeners[event] = cb;
			}),
			removeEventListener: jest.fn(),
			play: jest.fn().mockResolvedValue({}),
			pause: jest.fn(),
			load: jest.fn(),
			currentTime: 0,
			duration: 100,
			paused: true,
			readyState: 4,
			error: null,
		};
	});

	it("renders playback buttons", () => {
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		expect(getByTestId("button-Play")).toBeInTheDocument();
		expect(getByTestId("button-Stop")).toBeInTheDocument();
	});

	it("does not flash a loading indicator when playback starts immediately", () => {
		const { getByTestId, queryByRole } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		fireEvent.click(getByTestId("button-Play"));
		expect(mockPlayer.play).toHaveBeenCalled();
		expect(queryByRole("progressbar")).not.toBeInTheDocument();

		act(() => {
			eventListeners.loadstart();
		});
		expect(queryByRole("progressbar")).not.toBeInTheDocument();

		act(() => {
			eventListeners.playing();
		});
		expect(queryByRole("progressbar")).not.toBeInTheDocument();
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
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} renewing={true} />,
		);
		expect(getByTestId("button-Loading")).toBeInTheDocument();
	});

	it("renders loading button when duration is NaN", () => {
		mockPlayer.duration = NaN;
		const { getByTestId } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);
		expect(getByTestId("button-Loading")).toBeInTheDocument();
	});

	it("returns to Play when media is ready without starting playback", () => {
		const { getByTestId, queryByRole } = render(
			<Controls show={true} playerRef={mockPlayer} />,
		);

		act(() => {
			eventListeners.loadstart();
		});
		expect(getByTestId("button-Loading")).toBeInTheDocument();

		act(() => {
			eventListeners.canplay();
		});
		expect(getByTestId("button-Play")).toBeInTheDocument();
		expect(queryByRole("progressbar")).not.toBeInTheDocument();

		mockPlayer.paused = false;
		act(() => {
			eventListeners.play();
		});
		expect(getByTestId("button-Pause")).toBeInTheDocument();

		act(() => {
			eventListeners.playing();
		});
		expect(getByTestId("button-Pause")).toBeInTheDocument();
	});

	it("replays and forwards via buttons", () => {
		mockPlayer.currentTime = 20;
		render(<Controls show playerRef={mockPlayer} />);
		act(() => {
			eventListeners.timeupdate();
		});
		fireEvent.click(screen.getByTestId("button-Replay"));
		expect(mockPlayer.currentTime).toBe(10);
		fireEvent.click(screen.getByTestId("button-Forward"));
		expect(mockPlayer.currentTime).toBe(20);
	});

	it("clamps replay to zero and forward to duration", () => {
		mockPlayer.currentTime = 5;
		render(<Controls show playerRef={mockPlayer} />);
		act(() => {
			eventListeners.timeupdate();
		});
		fireEvent.click(screen.getByTestId("button-Replay"));
		expect(mockPlayer.currentTime).toBe(0);

		mockPlayer.currentTime = 95;
		act(() => {
			eventListeners.timeupdate();
		});
		fireEvent.click(screen.getByTestId("button-Forward"));
		expect(mockPlayer.currentTime).toBe(100);
	});

	it("swaps replay/forward icons for rtl direction", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		render(<Controls show playerRef={mockPlayer} />);
		expect(screen.getByTestId("button-Forward")).toBeInTheDocument();
		expect(screen.getByTestId("button-Replay")).toBeInTheDocument();
	});

	it("stops playback and resets current time", () => {
		mockPlayer.currentTime = 40;
		render(<Controls show playerRef={mockPlayer} />);
		act(() => {
			eventListeners.timeupdate();
		});
		fireEvent.click(screen.getByTestId("button-Stop"));
		expect(mockPlayer.pause).toHaveBeenCalled();
		expect(mockPlayer.currentTime).toBe(0);
	});

	it("handles seek keyboard shortcuts", () => {
		mockPlayer.currentTime = 50;
		render(<Controls show playerRef={mockPlayer} />);
		act(() => {
			eventListeners.timeupdate();
		});
		const slider = screen.getByRole("slider");
		fireEvent.keyDown(slider, { key: "ArrowLeft" });
		expect(mockPlayer.currentTime).toBe(40);
		fireEvent.keyDown(slider, { key: "ArrowRight" });
		expect(mockPlayer.currentTime).toBe(50);
		fireEvent.keyDown(slider, { key: "Home" });
		expect(mockPlayer.currentTime).toBe(0);
		fireEvent.keyDown(slider, { key: "End" });
		expect(mockPlayer.currentTime).toBe(100);
		fireEvent.keyDown(slider, { key: "ArrowDown" });
		expect(mockPlayer.currentTime).toBe(90);
		fireEvent.keyDown(slider, { key: "ArrowUp" });
		expect(mockPlayer.currentTime).toBe(100);
	});

	it("ignores keyboard seek when duration is missing", () => {
		mockPlayer.duration = 0;
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
		expect(mockPlayer.currentTime).toBe(0);
	});

	it("supports mouse drag seeking on the progress bar", () => {
		render(<Controls show playerRef={mockPlayer} />);
		const slider = screen.getByRole("slider");
		slider.getBoundingClientRect = () => ({ left: 0, width: 100 });
		Object.defineProperty(slider, "clientWidth", { value: 100 });

		fireEvent.mouseDown(slider, { clientX: 25 });
		expect(mockPlayer.currentTime).toBe(25);
		fireEvent.mouseMove(document, { clientX: 50 });
		expect(mockPlayer.currentTime).toBe(50);
		fireEvent.mouseUp(document, { clientX: 75 });
		expect(mockPlayer.currentTime).toBe(75);
	});

	it("supports touch drag seeking", () => {
		render(<Controls show playerRef={mockPlayer} />);
		const slider = screen.getByRole("slider");
		slider.getBoundingClientRect = () => ({ left: 0, width: 100 });
		Object.defineProperty(slider, "clientWidth", { value: 100 });

		fireEvent.touchStart(slider, { touches: [{ clientX: 10 }] });
		fireEvent.touchMove(document, { touches: [{ clientX: 40 }] });
		expect(mockPlayer.currentTime).toBe(40);
		fireEvent.touchEnd(document, { changedTouches: [{ clientX: 40 }] });
	});

	it("prevents context menu on the progress bar", () => {
		render(<Controls show playerRef={mockPlayer} />);
		const slider = screen.getByRole("slider");
		const event = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
		});
		slider.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it("shows error alert after delayed error event and allows reload", () => {
		jest.useFakeTimers();
		const renewUrl = jest.fn();
		render(<Controls show playerRef={mockPlayer} renewUrl={renewUrl} />);
		act(() => {
			eventListeners.error();
			jest.advanceTimersByTime(2000);
		});
		expect(screen.getByText("Playback error")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("button-Reload"));
		expect(renewUrl).toHaveBeenCalled();
		expect(mockPlayer.load).not.toHaveBeenCalled();
	});

	it("falls back to load when reload has no renewUrl", () => {
		jest.useFakeTimers();
		render(<Controls show playerRef={mockPlayer} />);
		act(() => {
			eventListeners.error();
			jest.advanceTimersByTime(2000);
		});
		fireEvent.click(screen.getByTestId("button-Reload"));
		expect(mockPlayer.load).toHaveBeenCalled();
	});

	it("clears pending errors when renewing", () => {
		jest.useFakeTimers();
		const { rerender } = render(
			<Controls show playerRef={mockPlayer} renewing={false} />,
		);
		act(() => {
			eventListeners.error();
		});
		rerender(<Controls show playerRef={mockPlayer} renewing={true} />);
		act(() => {
			jest.advanceTimersByTime(2000);
		});
		expect(screen.queryByText("Playback error")).not.toBeInTheDocument();
	});

	it("ignores error events while renewing", () => {
		jest.useFakeTimers();
		render(<Controls show playerRef={mockPlayer} renewing />);
		act(() => {
			eventListeners.error();
			jest.advanceTimersByTime(2000);
		});
		expect(screen.queryByText("Playback error")).not.toBeInTheDocument();
	});

	it("restores metadata position on loadedmetadata", () => {
		useFile.mockReturnValue([
			{ key1: { position: 33 } },
			false,
			false,
			setMetadata,
		]);
		mockPlayer.readyState = 1;
		mockPlayer.currentTime = 0;
		render(
			<Controls
				show
				playerRef={mockPlayer}
				metadataPath="/meta.json"
				metadataKey="key1"
			/>,
		);
		act(() => {
			eventListeners.loadedmetadata();
		});
		expect(mockPlayer.currentTime).toBe(33);
	});

	it("skips metadata restore when metadataKey is missing", () => {
		useFile.mockReturnValue([{ position: 10 }, false, false, setMetadata]);
		render(<Controls show playerRef={mockPlayer} metadataPath="/meta.json" />);
		act(() => {
			eventListeners.loadedmetadata();
		});
		expect(mockPlayer.currentTime).toBe(0);
	});

	it("writes metadata position while playing", () => {
		mockPlayer.currentTime = 12;
		render(
			<Controls
				show
				playerRef={mockPlayer}
				metadataKey="sess"
				metadataPath="/m.json"
			/>,
		);
		act(() => {
			eventListeners.timeupdate();
		});
		expect(setMetadata).toHaveBeenCalled();
		const updater = setMetadata.mock.calls.at(-1)[0];
		expect(updater(null)).toEqual({
			sess: { duration: 100, position: 12 },
		});
		expect(updater({ sess: { position: 1 } })).toEqual({
			sess: { duration: 100, position: 12 },
		});
	});

	it("reloads when path changes", () => {
		const { rerender } = render(
			<Controls show playerRef={mockPlayer} path="/a.mp3" />,
		);
		rerender(<Controls show playerRef={mockPlayer} path="/b.mp3" />);
		// Session/path changes stop playback; Audio/Video own load().
		expect(mockPlayer.pause).toHaveBeenCalled();
		expect(mockPlayer.currentTime).toBe(0);
	});

	it("preserves position and resumes when the signed URL renews while playing", () => {
		mockPlayer.currentTime = 42;
		mockPlayer.paused = false;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
				renewing
			/>,
		);
		act(() => {
			eventListeners.playing();
		});
		mockPlayer.pause.mockClear();
		mockPlayer.load.mockClear();
		mockPlayer.play.mockClear();

		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=2"
				sessionKey="session-a"
				renewing
			/>,
		);

		// Audio/Video own load(); Controls must not stop/restart the session.
		expect(mockPlayer.load).not.toHaveBeenCalled();
		expect(mockPlayer.pause).not.toHaveBeenCalled();
		expect(mockPlayer.currentTime).toBe(42);

		act(() => {
			eventListeners.loadedmetadata();
		});
		expect(mockPlayer.currentTime).toBe(42);

		act(() => {
			eventListeners.canplay();
		});
		expect(mockPlayer.play).toHaveBeenCalled();
	});

	it("preserves position without autoplay when renewing while paused", () => {
		mockPlayer.currentTime = 42;
		mockPlayer.paused = true;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
				renewing
			/>,
		);
		act(() => {
			eventListeners.timeupdate();
		});
		mockPlayer.play.mockClear();

		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=2"
				sessionKey="session-a"
				renewing
			/>,
		);
		act(() => {
			eventListeners.loadedmetadata();
			eventListeners.canplay();
		});
		expect(mockPlayer.currentTime).toBe(42);
		expect(mockPlayer.play).not.toHaveBeenCalled();
	});

	it("keeps play intent when error is followed by pause before renew", () => {
		mockPlayer.currentTime = 48;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
			/>,
		);
		fireEvent.click(screen.getByTestId("button-Play"));
		act(() => {
			eventListeners.playing();
			eventListeners.timeupdate();
		});
		mockPlayer.play.mockClear();
		mockPlayer.error = { code: 2 };

		// Expiry typically emits error then pause while renewing is still false.
		act(() => {
			eventListeners.error();
			eventListeners.pause();
		});

		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=2"
				sessionKey="session-a"
				renewing
			/>,
		);
		act(() => {
			eventListeners.loadedmetadata();
			eventListeners.canplay();
		});
		expect(mockPlayer.currentTime).toBe(48);
		expect(mockPlayer.play).toHaveBeenCalled();
	});

	it("does not autoplay after the user pauses during a pending renew", () => {
		const renewUrl = jest.fn();
		mockPlayer.currentTime = 30;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
				renewUrl={renewUrl}
			/>,
		);
		fireEvent.click(screen.getByTestId("button-Play"));
		mockPlayer.paused = false;
		act(() => {
			eventListeners.playing();
			eventListeners.timeupdate();
			eventListeners.error();
		});
		// User explicitly pauses while waiting for a fresh URL.
		fireEvent.click(screen.getByTestId("button-Pause"));
		mockPlayer.play.mockClear();

		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=2"
				sessionKey="session-a"
				renewUrl={renewUrl}
			/>,
		);
		act(() => {
			eventListeners.loadedmetadata();
			eventListeners.canplay();
		});
		expect(mockPlayer.currentTime).toBe(30);
		expect(mockPlayer.play).not.toHaveBeenCalled();
	});

	it("reloads via renewUrl and resumes after a playback error while playing", () => {
		jest.useFakeTimers();
		const renewUrl = jest.fn();
		mockPlayer.currentTime = 55;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
				renewUrl={renewUrl}
			/>,
		);
		fireEvent.click(screen.getByTestId("button-Play"));
		act(() => {
			eventListeners.playing();
			eventListeners.timeupdate();
			eventListeners.error();
			jest.advanceTimersByTime(2000);
		});
		fireEvent.click(screen.getByTestId("button-Reload"));
		expect(renewUrl).toHaveBeenCalled();

		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=2"
				sessionKey="session-a"
				renewUrl={renewUrl}
			/>,
		);
		act(() => {
			eventListeners.loadedmetadata();
			eventListeners.canplay();
		});
		expect(mockPlayer.currentTime).toBe(55);
		expect(mockPlayer.play).toHaveBeenCalled();
	});

	it("clears resume intent when the session changes", () => {
		mockPlayer.currentTime = 40;
		const { rerender } = render(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/a?sig=1"
				sessionKey="session-a"
				renewing
			/>,
		);
		act(() => {
			eventListeners.playing();
		});
		rerender(
			<Controls
				show
				playerRef={mockPlayer}
				path="https://media.example/b?sig=1"
				sessionKey="session-b"
				renewing={false}
			/>,
		);
		expect(mockPlayer.pause).toHaveBeenCalled();
		expect(mockPlayer.currentTime).toBe(0);
		mockPlayer.play.mockClear();
		act(() => {
			eventListeners.loadedmetadata();
			eventListeners.canplay();
		});
		expect(mockPlayer.play).not.toHaveBeenCalled();
	});

	it("handles play rejection", async () => {
		mockPlayer.play.mockRejectedValueOnce(new Error("blocked"));
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.click(screen.getByTestId("button-Play"));
		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByTestId("button-Play")).toBeInTheDocument();
	});

	it("shows play pending after delay when playback is slow", () => {
		jest.useFakeTimers();
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.click(screen.getByTestId("button-Play"));
		act(() => {
			jest.advanceTimersByTime(150);
		});
		expect(screen.getByTestId("button-Loading")).toBeInTheDocument();
	});

	it("throttles timeupdate when page is not visible", () => {
		usePageVisibility.mockReturnValue(false);
		render(<Controls show={false} playerRef={mockPlayer} />);
		mockPlayer.currentTime = 5;
		act(() => {
			eventListeners.timeupdate();
		});
		mockPlayer.currentTime = 20;
		act(() => {
			eventListeners.timeupdate();
		});
		expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "20");
	});

	it("omits total duration when noDuration is set", () => {
		render(<Controls show playerRef={mockPlayer} noDuration />);
		act(() => {
			eventListeners.timeupdate();
		});
		expect(screen.getByText(/Time left/)).toBeInTheDocument();
	});

	it("applies video variant class and session media metadata inputs", () => {
		const { container } = render(
			<Controls
				show
				playerRef={mockPlayer}
				variant="video"
				sessionName="Talk"
				groupName="choir"
				sessionDate="2024-01-02"
				color="#f00"
				zIndex={9}
			/>,
		);
		expect(container.querySelector('[style*="z-index: 9"]')).toBeTruthy();
	});

	it("clears loading on waiting/seeking then seeked/pause", () => {
		render(<Controls show playerRef={mockPlayer} path="/ready.mp3" />);
		act(() => {
			eventListeners.canplay();
		});
		act(() => {
			eventListeners.waiting();
		});
		expect(screen.getByTestId("button-Loading")).toBeInTheDocument();
		act(() => {
			eventListeners.seeked();
		});
		expect(screen.getByTestId("button-Play")).toBeInTheDocument();
		act(() => {
			eventListeners.seeking();
		});
		act(() => {
			eventListeners.pause();
		});
		expect(screen.getByTestId("button-Play")).toBeInTheDocument();
	});

	it("clears error on loadstart while renewing", () => {
		jest.useFakeTimers();
		render(<Controls show playerRef={mockPlayer} renewing />);
		act(() => {
			eventListeners.loadstart();
			jest.advanceTimersByTime(2000);
		});
		expect(screen.queryByText("Playback error")).not.toBeInTheDocument();
	});

	it("clamps seek position to duration bounds", () => {
		render(<Controls show playerRef={mockPlayer} />);
		const slider = screen.getByRole("slider");
		slider.getBoundingClientRect = () => ({ left: 0, width: 100 });
		Object.defineProperty(slider, "clientWidth", { value: 100 });
		fireEvent.mouseDown(slider, { clientX: -10 });
		expect(mockPlayer.currentTime).toBe(0);
		fireEvent.mouseDown(slider, { clientX: 200 });
		expect(mockPlayer.currentTime).toBe(100);
	});

	it("ignores seek when not dragging or clientX missing", () => {
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.mouseMove(document, { clientX: 50 });
		expect(mockPlayer.currentTime).toBe(0);
	});

	it("updates metadata without nested key when metadataKey falsy after timeupdate", () => {
		mockPlayer.currentTime = 8;
		// metadataKey required for the write effect; cover nested updater branches only
		render(
			<Controls
				show
				playerRef={mockPlayer}
				metadataKey="sess"
				metadataPath="/m.json"
			/>,
		);
		act(() => {
			eventListeners.timeupdate();
		});
		const updater = setMetadata.mock.calls.at(-1)[0];
		expect(updater({ other: 1 })).toEqual({
			other: 1,
			sess: { duration: 100, position: 8 },
		});
	});

	it("does not seek when position is NaN", () => {
		mockPlayer.duration = NaN;
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.click(screen.getByTestId("button-Loading"));
	});

	it("shows play pending after a slow play() promise", async () => {
		jest.useFakeTimers();
		mockPlayer.play.mockImplementation(
			() => new Promise((resolve) => setTimeout(resolve, 2000)),
		);
		render(<Controls show playerRef={mockPlayer} />);
		fireEvent.click(screen.getByTestId("button-Play"));
		act(() => {
			jest.advanceTimersByTime(600);
		});
		expect(screen.getByTestId("button-Loading")).toBeInTheDocument();
		jest.useRealTimers();
	});

	it("uses bottom speed toolbar class for video controls", () => {
		render(<Controls show playerRef={mockPlayer} variant="video" />);
		expect(document.querySelector("[class*='video']")).toBeTruthy();
	});
});
