import { act, renderHook } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import { useMediaSession } from "./mediaSession";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function createFakePlayer(overrides = {}) {
	const player = document.createElement("div");
	player.play = jest.fn().mockResolvedValue(undefined);
	player.pause = jest.fn();
	player.load = jest.fn();
	player.networkState = overrides.networkState ?? 0;
	player.currentTime = overrides.currentTime ?? 0;
	player.duration = overrides.duration ?? 100;
	player.paused = overrides.paused ?? true;
	player.ended = overrides.ended ?? false;
	player.playbackRate = overrides.playbackRate ?? 1;
	return player;
}

function getHandler(mediaSessionMock, action) {
	const call = mediaSessionMock.setActionHandler.mock.calls.find(
		([name]) => name === action,
	);
	return call?.[1];
}

let visibilityState = "visible";
Object.defineProperty(document, "visibilityState", {
	get: () => visibilityState,
	configurable: true,
});

describe("useMediaSession", () => {
	let mediaSessionMock;
	let originalMediaSession;
	let originalMediaMetadata;

	beforeAll(() => {
		originalMediaMetadata = global.MediaMetadata;
		global.MediaMetadata = function MediaMetadata(data) {
			Object.assign(this, data);
		};
	});

	afterAll(() => {
		global.MediaMetadata = originalMediaMetadata;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		visibilityState = "visible";
		mediaSessionMock = {
			setActionHandler: jest.fn(),
			setPositionState: jest.fn(),
			metadata: null,
			playbackState: "none",
		};
		originalMediaSession = navigator.mediaSession;
		navigator.mediaSession = mediaSessionMock;
	});

	afterEach(() => {
		if (originalMediaSession === undefined) {
			delete navigator.mediaSession;
		} else {
			navigator.mediaSession = originalMediaSession;
		}
	});

	describe("action handler registration", () => {
		it("does not register handlers when disabled", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: false }));
			expect(mediaSessionMock.setActionHandler).not.toHaveBeenCalled();
		});

		it("does not register handlers when there is no player", () => {
			renderHook(() => useMediaSession({ playerRef: null, enabled: true }));
			expect(mediaSessionMock.setActionHandler).not.toHaveBeenCalled();
		});

		it("does not throw when mediaSession is unsupported", () => {
			delete navigator.mediaSession;
			const player = createFakePlayer();
			expect(() =>
				renderHook(() => useMediaSession({ playerRef: player, enabled: true })),
			).not.toThrow();
		});

		it("registers all action handlers and unregisters them on unmount", () => {
			const player = createFakePlayer();
			const { unmount } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);

			const actions = [
				"play",
				"pause",
				"seekforward",
				"seekbackward",
				"seekto",
				"stop",
			];
			for (const action of actions) {
				expect(mediaSessionMock.setActionHandler).toHaveBeenCalledWith(
					action,
					expect.any(Function),
				);
			}

			unmount();

			for (const action of actions) {
				expect(mediaSessionMock.setActionHandler).toHaveBeenCalledWith(
					action,
					null,
				);
			}
		});

		it("warns and continues when a handler fails to register", () => {
			mediaSessionMock.setActionHandler.mockImplementation((action) => {
				if (action === "play") throw new Error("not supported");
			});
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			expect(structuredLogger.warn).toHaveBeenCalledWith(
				"[MediaSession] Handler 'play' not supported:",
				expect.any(Error),
			);
			expect(mediaSessionMock.setActionHandler).toHaveBeenCalledWith(
				"pause",
				expect.any(Function),
			);
		});

		it("swallows errors thrown while unregistering handlers", () => {
			mediaSessionMock.setActionHandler.mockImplementation((action, fn) => {
				if (fn === null) throw new Error("cleanup failure");
			});
			const player = createFakePlayer();
			const { unmount } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);
			expect(() => unmount()).not.toThrow();
		});
	});

	describe("play handler / safePlay", () => {
		it("plays the media element", async () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const play = getHandler(mediaSessionMock, "play");
			await act(async () => {
				await play();
			});
			expect(player.play).toHaveBeenCalled();
			expect(player.load).not.toHaveBeenCalled();
		});

		it("reloads before playing when the network has no source", async () => {
			const player = createFakePlayer({
				networkState: HTMLMediaElement.NETWORK_NO_SOURCE,
			});
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const play = getHandler(mediaSessionMock, "play");
			await act(async () => {
				await play();
			});
			expect(player.load).toHaveBeenCalled();
			expect(player.play).toHaveBeenCalled();
		});

		it("retries by reloading when play fails with NotSupportedError", async () => {
			const player = createFakePlayer();
			const notSupported = Object.assign(new Error("nope"), {
				name: "NotSupportedError",
			});
			player.play
				.mockRejectedValueOnce(notSupported)
				.mockResolvedValueOnce(undefined);
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const play = getHandler(mediaSessionMock, "play");
			await act(async () => {
				await play();
			});
			expect(player.load).toHaveBeenCalledTimes(1);
			expect(player.play).toHaveBeenCalledTimes(2);
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"[MediaSession] Play failed:",
				notSupported,
			);
		});

		it("logs when the retry after AbortError also fails", async () => {
			const player = createFakePlayer();
			const aborted = Object.assign(new Error("abort"), {
				name: "AbortError",
			});
			const retryError = new Error("retry failed");
			player.play
				.mockRejectedValueOnce(aborted)
				.mockRejectedValueOnce(retryError);
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const play = getHandler(mediaSessionMock, "play");
			await act(async () => {
				await play();
			});
			expect(structuredLogger.error).toHaveBeenCalledWith(
				"[MediaSession] Retry play failed:",
				retryError,
			);
		});

		it("does not retry for unrelated play errors", async () => {
			const player = createFakePlayer();
			player.play.mockRejectedValueOnce(new Error("network down"));
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const play = getHandler(mediaSessionMock, "play");
			await act(async () => {
				await play();
			});
			expect(player.load).not.toHaveBeenCalled();
			expect(player.play).toHaveBeenCalledTimes(1);
		});

		it("does nothing when there is no player reference", async () => {
			const { result } = renderHook(() =>
				useMediaSession({ playerRef: null, enabled: false }),
			);
			await expect(result.current.attemptResume()).resolves.toBeUndefined();
		});
	});

	describe("other action handlers", () => {
		it("pauses on the pause action", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "pause")();
			expect(player.pause).toHaveBeenCalled();
		});

		it("seeks forward by the default offset and clamps to duration", () => {
			const player = createFakePlayer({ currentTime: 95, duration: 100 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekforward")();
			expect(player.currentTime).toBe(100);
		});

		it("seeks forward using the requested offset", () => {
			const player = createFakePlayer({ currentTime: 10, duration: 100 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekforward")({ seekOffset: 5 });
			expect(player.currentTime).toBe(15);
		});

		it("seeks backward and clamps to zero", () => {
			const player = createFakePlayer({ currentTime: 5 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekbackward")();
			expect(player.currentTime).toBe(0);
		});

		it("seeks backward using the requested offset", () => {
			const player = createFakePlayer({ currentTime: 50 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekbackward")({ seekOffset: 20 });
			expect(player.currentTime).toBe(30);
		});

		it("seeks to the requested time", () => {
			const player = createFakePlayer({ currentTime: 5 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekto")({ seekTime: 42 });
			expect(player.currentTime).toBe(42);
		});

		it("ignores seekto without a seekTime", () => {
			const player = createFakePlayer({ currentTime: 5 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "seekto")({});
			expect(player.currentTime).toBe(5);
		});

		it("stops playback and resets the position", () => {
			const player = createFakePlayer({ currentTime: 30 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			getHandler(mediaSessionMock, "stop")();
			expect(player.pause).toHaveBeenCalled();
			expect(player.currentTime).toBe(0);
		});
	});

	describe("metadata updates", () => {
		it("sets default metadata when no title or artist is provided", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			expect(navigator.mediaSession.metadata).toMatchObject({
				title: "Session",
				artist: "",
				album: "",
			});
		});

		it("sets metadata with title, artist, and artwork", () => {
			const player = createFakePlayer();
			renderHook(() =>
				useMediaSession({
					playerRef: player,
					enabled: true,
					title: "My Track",
					artist: "My Artist",
					artworkUrl: "https://example.com/art.png",
				}),
			);
			expect(navigator.mediaSession.metadata).toMatchObject({
				title: "My Track",
				artist: "My Artist",
				artwork: [
					{
						src: "https://example.com/art.png",
						sizes: "512x512",
						type: "image/png",
					},
				],
			});
		});

		it("does not set metadata when disabled", () => {
			const player = createFakePlayer();
			renderHook(() =>
				useMediaSession({ playerRef: player, enabled: false, title: "T" }),
			);
			expect(navigator.mediaSession.metadata).toBeNull();
		});

		it("warns when metadata construction throws", () => {
			const originalMediaMetadata = global.MediaMetadata;
			global.MediaMetadata = function () {
				throw new Error("bad metadata");
			};
			const player = createFakePlayer();
			renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true, title: "T" }),
			);
			expect(structuredLogger.warn).toHaveBeenCalledWith(
				"[MediaSession] Failed to set metadata:",
				expect.any(Error),
			);
			global.MediaMetadata = originalMediaMetadata;
		});
	});

	describe("position state updates", () => {
		it("clears the position state when duration is unavailable", () => {
			const player = createFakePlayer({ duration: NaN });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			expect(mediaSessionMock.setPositionState).toHaveBeenCalledWith(null);
		});

		it("sets the position state from the player's current state", () => {
			const player = createFakePlayer({
				duration: 120,
				currentTime: 30,
				playbackRate: 1.5,
			});
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			expect(mediaSessionMock.setPositionState).toHaveBeenCalledWith({
				duration: 120,
				playbackRate: 1.5,
				position: 30,
			});
		});

		it("updates the position state on playback progress events", () => {
			const player = createFakePlayer({ duration: 120 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			const callsBefore = mediaSessionMock.setPositionState.mock.calls.length;
			player.currentTime = 60;
			act(() => {
				player.dispatchEvent(new Event("timeupdate", { bubbles: false }));
				player.dispatchEvent(new Event("seeked"));
			});
			expect(
				mediaSessionMock.setPositionState.mock.calls.length,
			).toBeGreaterThan(callsBefore);
		});

		it("stops updating the position state after unmount", () => {
			const player = createFakePlayer({ duration: 120 });
			const { unmount } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);
			unmount();
			const callsAfterUnmount =
				mediaSessionMock.setPositionState.mock.calls.length;
			act(() => {
				player.dispatchEvent(new Event("seeked"));
			});
			expect(mediaSessionMock.setPositionState.mock.calls.length).toBe(
				callsAfterUnmount,
			);
		});

		it("warns when setPositionState throws", () => {
			mediaSessionMock.setPositionState.mockImplementation(() => {
				throw new Error("bad state");
			});
			const player = createFakePlayer({ duration: 120 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			expect(structuredLogger.warn).toHaveBeenCalledWith(
				"[MediaSession] Failed to update position state:",
				expect.any(Error),
			);
		});

		it("does not touch position state when disabled", () => {
			const player = createFakePlayer({ duration: 120 });
			renderHook(() => useMediaSession({ playerRef: player, enabled: false }));
			expect(mediaSessionMock.setPositionState).not.toHaveBeenCalled();
		});
	});

	describe("playback state tracking", () => {
		it("tracks playing and paused state transitions", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			act(() => {
				player.dispatchEvent(new Event("play"));
			});
			expect(navigator.mediaSession.playbackState).toBe("playing");

			act(() => {
				player.dispatchEvent(new Event("pause"));
			});
			expect(navigator.mediaSession.playbackState).toBe("paused");

			act(() => {
				player.dispatchEvent(new Event("playing"));
			});
			expect(navigator.mediaSession.playbackState).toBe("playing");
		});

		it("still tracks lastPlayState when mediaSession is unsupported", () => {
			delete navigator.mediaSession;
			const player = createFakePlayer();
			expect(() =>
				renderHook(() => useMediaSession({ playerRef: player, enabled: true })),
			).not.toThrow();
			expect(() =>
				act(() => {
					player.dispatchEvent(new Event("play"));
				}),
			).not.toThrow();
		});
	});

	describe("visibility change recovery", () => {
		it("resumes playback if it was interrupted while the tab was hidden", () => {
			jest.useFakeTimers();
			const player = createFakePlayer({ paused: false });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			visibilityState = "hidden";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			player.paused = true;
			visibilityState = "visible";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			act(() => {
				jest.advanceTimersByTime(100);
			});

			expect(player.play).toHaveBeenCalled();
			jest.useRealTimers();
		});

		it("does not resume when playback ended", () => {
			jest.useFakeTimers();
			const player = createFakePlayer({ paused: false, ended: true });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			visibilityState = "hidden";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});
			player.paused = true;
			visibilityState = "visible";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
				jest.advanceTimersByTime(200);
			});

			expect(player.play).not.toHaveBeenCalled();
			jest.useRealTimers();
		});

		it("does not attempt recovery when disabled", () => {
			const player = createFakePlayer({ paused: false });
			renderHook(() => useMediaSession({ playerRef: player, enabled: false }));
			visibilityState = "hidden";
			expect(() =>
				act(() => {
					document.dispatchEvent(new Event("visibilitychange"));
				}),
			).not.toThrow();
		});
	});

	describe("interruption recovery and diagnostics", () => {
		it("resets the recovery flag once playback pauses, since lastPlayState is cleared first", () => {
			const player = createFakePlayer();
			const { result } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);

			act(() => {
				player.dispatchEvent(new Event("play"));
			});
			act(() => {
				player.dispatchEvent(new Event("pause"));
			});

			expect(result.current.getWasPlaying()).toBe(false);
		});

		it("sets the recovery flag via the visibility-change path and clears it on the next play", () => {
			const player = createFakePlayer({ paused: false });
			const { result } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);

			visibilityState = "hidden";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});
			expect(result.current.getWasPlaying()).toBe(true);

			act(() => {
				player.dispatchEvent(new Event("play"));
			});
			expect(result.current.getWasPlaying()).toBe(false);
		});

		it("clears an existing pause timeout when pause fires again", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			act(() => {
				player.dispatchEvent(new Event("play"));
				player.dispatchEvent(new Event("pause"));
				player.dispatchEvent(new Event("pause"));
			});

			expect(() =>
				act(() => {
					player.dispatchEvent(new Event("play"));
				}),
			).not.toThrow();
		});

		it("logs debug messages for stalled and waiting events", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			act(() => {
				player.dispatchEvent(new Event("stalled"));
				player.dispatchEvent(new Event("waiting"));
			});

			expect(structuredLogger.debug).toHaveBeenCalledWith(
				"[MediaSession] Stalled event - possible connection timeout",
			);
			expect(structuredLogger.debug).toHaveBeenCalledWith(
				"[MediaSession] Waiting for data",
			);
		});

		it("attempts to resume playback after returning to a visible tab", () => {
			jest.useFakeTimers();
			const player = createFakePlayer({ paused: false });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));

			visibilityState = "hidden";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
			});
			player.paused = true;
			visibilityState = "visible";
			act(() => {
				document.dispatchEvent(new Event("visibilitychange"));
				jest.advanceTimersByTime(150);
			});

			expect(player.play).toHaveBeenCalled();
			jest.useRealTimers();
		});

		it("clears pending pause timeouts when the hook unmounts", () => {
			jest.useFakeTimers();
			const player = createFakePlayer();
			const { unmount } = renderHook(() =>
				useMediaSession({ playerRef: player, enabled: true }),
			);
			act(() => {
				player.dispatchEvent(new Event("play"));
				player.dispatchEvent(new Event("pause"));
			});
			expect(() => unmount()).not.toThrow();
			jest.useRealTimers();
		});

		it("sets artwork metadata when artworkUrl is provided", () => {
			const player = createFakePlayer();
			renderHook(() =>
				useMediaSession({
					playerRef: player,
					enabled: true,
					title: "Talk",
					artist: "Group",
					artworkUrl: "https://example.com/art.png",
				}),
			);
			expect(mediaSessionMock.metadata.artwork[0].src).toBe(
				"https://example.com/art.png",
			);
		});

		it("falls back to default title and artist metadata", () => {
			const player = createFakePlayer();
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			expect(mediaSessionMock.metadata.title).toBe("Session");
			expect(mediaSessionMock.metadata.artist).toBe("");
		});

		it("clears position state when duration is unavailable", () => {
			const player = createFakePlayer({ duration: NaN });
			renderHook(() => useMediaSession({ playerRef: player, enabled: true }));
			act(() => {
				player.dispatchEvent(new Event("timeupdate"));
			});
			expect(mediaSessionMock.setPositionState).toHaveBeenCalledWith(null);
		});

		it("ignores unsupported handler registration errors", () => {
			const player = createFakePlayer();
			mediaSessionMock.setActionHandler.mockImplementation((action) => {
				if (action === "seekto") {
					throw new Error("unsupported");
				}
			});
			expect(() =>
				renderHook(() => useMediaSession({ playerRef: player, enabled: true })),
			).not.toThrow();
			expect(structuredLogger.warn).toHaveBeenCalled();
		});
	});
});
