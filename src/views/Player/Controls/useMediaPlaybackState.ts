import { logger as structuredLogger } from "@util/api/logger";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export const SKIP_POINTS = 10;
const PLAY_LOADING_DELAY_MS = 150;

export interface PendingResume {
	position: number;
	shouldPlay: boolean;
}

function resumeIntent(
	currentTime: number,
	fallback: number,
	shouldPlay: boolean,
): PendingResume {
	const position =
		Number.isFinite(currentTime) && currentTime > 0 ? currentTime : fallback;
	return { position: position > 0 ? position : 0, shouldPlay };
}

interface UseMediaPlaybackStateOptions {
	path: string | null | undefined;
	playerRef: any;
	metadataKey?: string;
	metadataRef: MutableRefObject<any>;
	show?: boolean;
	visible: boolean;
	renewing?: boolean;
	renewUrl?: () => void;
	sessionKey?: string;
	draggingRef: MutableRefObject<boolean>;
}

/**
 * Manages HTMLMediaElement playback state, loading/error transitions,
 * signed-URL renewal resume, and transport actions.
 */
export function useMediaPlaybackState({
	path,
	playerRef,
	metadataKey,
	metadataRef,
	show,
	visible,
	renewing,
	renewUrl,
	sessionKey,
	draggingRef,
}: UseMediaPlaybackStateOptions) {
	const [, setCounter] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [loading, setLoading] = useState(false);
	const [playPending, setPlayPending] = useState(false);
	const playPendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const playRequestedRef = useRef(false);
	// When a signed playing URL is renewed, preserve position + resume playback
	// instead of treating the new URL as a brand-new session.
	const pendingResumeRef = useRef<PendingResume | null>(null);
	const currentTimeRef = useRef(0);
	// Tracks whether the user intends playback to be running. Media errors and
	// load() often pause the element; this ref survives those so renew/resume
	// only autoplays when playback was actually wanted.
	const wantPlayingRef = useRef(false);

	const clearPlayPending = useCallback(() => {
		if (playPendingTimeoutRef.current) {
			clearTimeout(playPendingTimeoutRef.current);
			playPendingTimeoutRef.current = null;
		}
		playRequestedRef.current = false;
		setPlayPending(false);
	}, []);

	const [loadedPath, setLoadedPath] = useState(() => {
		if (playerRef && !isNaN(playerRef.duration) && playerRef.duration > 0) {
			return path;
		}
		return null;
	});

	const stateRef = useRef({ visible, show, path });
	useEffect(() => {
		stateRef.current = { visible, show, path };
	}, [visible, show, path]);

	useEffect(() => {
		currentTimeRef.current = currentTime;
	}, [currentTime]);

	const lastUpdateTimeRef = useRef(0);

	const beginPlay = useCallback(() => {
		// Do not flash a spinner for the usual immediate start. If playback has not
		// started shortly, show the pending state so slower signed URLs/buffering
		// still have clear feedback.
		if (playPendingTimeoutRef.current) {
			clearTimeout(playPendingTimeoutRef.current);
			playPendingTimeoutRef.current = null;
		}
		wantPlayingRef.current = true;
		playRequestedRef.current = true;
		playPendingTimeoutRef.current = setTimeout(() => {
			playPendingTimeoutRef.current = null;
			setPlayPending(true);
		}, PLAY_LOADING_DELAY_MS);
		playerRef.play().catch((err: any) => {
			clearPlayPending();
			structuredLogger.error(err);
		});
	}, [playerRef, clearPlayPending]);

	useEffect(() => {
		// Switching sessions must not resume the previous session's play intent.
		pendingResumeRef.current = null;
		wantPlayingRef.current = false;
	}, [sessionKey]);

	useEffect(() => {
		const clearPendingError = () => {
			if (errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current);
				errorTimeoutRef.current = null;
			}
			setError(null);
		};
		const update = (name: string) => {
			if (name === "error") {
				if (renewing) {
					clearPendingError();
					return;
				}
				// Media errors often emit pause next. Stash resume intent now so that
				// pause cannot clear wantPlaying before URL renew/path change runs.
				if (!pendingResumeRef.current) {
					pendingResumeRef.current = resumeIntent(
						playerRef.currentTime,
						currentTimeRef.current,
						wantPlayingRef.current,
					);
				}
				if (errorTimeoutRef.current) {
					clearTimeout(errorTimeoutRef.current);
				}
				errorTimeoutRef.current = setTimeout(() => {
					errorTimeoutRef.current = null;
					setError("PLAYING_ERROR");
				}, 2000);
			} else if (name === "loadstart") {
				if (renewing) {
					clearPendingError();
				}
			} else if (
				name === "loadedmetadata" ||
				name === "playing" ||
				name === "play"
			) {
				clearPendingError();
			}
			if (name === "loadstart" || name === "waiting" || name === "seeking") {
				// A loadstart commonly follows a Play click even when playback starts
				// immediately. Leave both the button and progress bar unchanged during
				// the brief grace period managed by play().
				if (playRequestedRef.current && name === "loadstart") {
					return;
				}
				setLoading(true);
			} else if (
				name === "playing" ||
				name === "pause" ||
				name === "seeked" ||
				name === "error"
			) {
				setLoading(false);
				if (name === "playing") {
					clearPlayPending();
					setLoadedPath(stateRef.current.path);
					pendingResumeRef.current = null;
					wantPlayingRef.current = true;
				}
				if (name === "pause") {
					// Error-induced and renew/load pauses must not cancel resume.
					// Any other pause (in-app, headset/MediaSession, keyboard, etc.)
					// cancels play intent including a pending renew.
					if (!renewing && !playerRef.error) {
						wantPlayingRef.current = false;
						if (pendingResumeRef.current) {
							pendingResumeRef.current = {
								...pendingResumeRef.current,
								shouldPlay: false,
							};
						}
					}
				}
				if (name === "error") {
					clearPlayPending();
				}
			}
			if (name === "canplay" || name === "loadedmetadata") {
				setLoadedPath(stateRef.current.path);
			}
			// `canplay` means the browser has enough media data to begin playback.
			// Clear the load-start spinner here as well as on `playing`: otherwise a
			// session that is ready but still paused remains labelled "Loading"
			// forever, even though its Play button is usable.
			if (name === "canplay") {
				setLoading(false);
				const resume = pendingResumeRef.current;
				if (resume?.shouldPlay) {
					pendingResumeRef.current = {
						...resume,
						shouldPlay: false,
					};
					beginPlay();
				}
			}
			if (name === "loadedmetadata") {
				const resume = pendingResumeRef.current;
				// A stashed renew resume (including position 0) must win over the
				// normal metadata bookmark restore.
				if (resume && Number.isFinite(resume.position)) {
					if (resume.position > 0) {
						playerRef.currentTime = resume.position;
						setCurrentTime(resume.position);
						currentTimeRef.current = resume.position;
					}
					return;
				}
				if (!metadataKey) return; // Skip if metadataKey not ready
				const currentMetadata = metadataKey
					? metadataRef.current?.[metadataKey] || {}
					: metadataRef.current || {};
				if (currentMetadata.position) {
					playerRef.currentTime = currentMetadata.position;
					setCurrentTime(playerRef.currentTime);
				}
			}
			if (name === "timeupdate" && !draggingRef.current) {
				const parsedTime = parseInt(playerRef.currentTime);

				if (stateRef.current.visible && stateRef.current.show) {
					// When visible, update on every timeupdate
					setCurrentTime(parsedTime);
					lastUpdateTimeRef.current = parsedTime;
				} else {
					// When not visible, only update every 10 seconds
					if (Math.abs(parsedTime - lastUpdateTimeRef.current) >= 10) {
						setCurrentTime(parsedTime);
						lastUpdateTimeRef.current = parsedTime;
					}
				}
			} else {
				setCounter((counter) => counter + 1);
			}
		};
		const events = [
			"loadedmetadata",
			"pause",
			"error",
			"loadstart",
			"play",
			"playing",
			"timeupdate",
			"ratechange",
			"waiting",
			"seeking",
			"seeked",
			"canplay",
			"durationchange",
		];
		const listeners = events.map((name) => {
			const callback = () => update(name);
			playerRef.addEventListener(name, callback);
			return { name, callback };
		});
		update("timeupdate");
		return () => {
			if (errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current);
				errorTimeoutRef.current = null;
			}
			if (playPendingTimeoutRef.current) {
				clearTimeout(playPendingTimeoutRef.current);
				playPendingTimeoutRef.current = null;
			}
			listeners.map(({ name, callback }) =>
				playerRef.removeEventListener(name, callback),
			);
		};
	}, [
		playerRef,
		metadataKey,
		renewing,
		clearPlayPending,
		beginPlay,
		metadataRef,
		draggingRef,
	]);

	useEffect(() => {
		if (renewing && errorTimeoutRef.current) {
			clearTimeout(errorTimeoutRef.current);
			errorTimeoutRef.current = null;
			setError(null);
		}
	}, [renewing]);

	const seekPosition = useCallback(
		(position: number) => {
			if (isNaN(position)) {
				return;
			}
			playerRef.currentTime = position;
			setCurrentTime(position);
		},
		[playerRef],
	);

	const replay = () => {
		let position = currentTime;
		if (position > SKIP_POINTS) {
			position -= SKIP_POINTS;
		} else {
			position = 0;
		}
		seekPosition(position);
	};

	const forward = () => {
		let position = currentTime;
		if (position > playerRef.duration - SKIP_POINTS) {
			position = playerRef.duration;
		} else {
			position += SKIP_POINTS;
		}
		seekPosition(position);
	};

	const play = () => {
		beginPlay();
	};

	const pause = () => {
		wantPlayingRef.current = false;
		if (pendingResumeRef.current) {
			pendingResumeRef.current = {
				...pendingResumeRef.current,
				shouldPlay: false,
			};
		}
		clearPlayPending();
		playerRef.pause();
	};

	const stop = useCallback(() => {
		wantPlayingRef.current = false;
		clearPlayPending();
		pendingResumeRef.current = null;
		playerRef.pause();
		playerRef.currentTime = 0;
		setCurrentTime(0);
	}, [playerRef, clearPlayPending]);

	const reloadMedia = useCallback(() => {
		pendingResumeRef.current = resumeIntent(
			playerRef.currentTime,
			currentTimeRef.current,
			wantPlayingRef.current,
		);
		setError(null);
		if (renewUrl) {
			renewUrl();
			return;
		}
		playerRef.load();
	}, [playerRef, renewUrl]);

	const prevPath = useRef(path);
	useEffect(() => {
		if (prevPath.current === path) {
			return;
		}
		const hadPreviousPath = !!prevPath.current;
		prevPath.current = path;

		// A new signed URL for the same session arrives while renewing/recovering.
		// Preserve position and optionally resume — Audio/Video own load().
		if (hadPreviousPath && path && (renewing || pendingResumeRef.current)) {
			const position =
				Number.isFinite(playerRef.currentTime) && playerRef.currentTime > 0
					? playerRef.currentTime
					: currentTimeRef.current;
			const stashed = pendingResumeRef.current?.position;
			pendingResumeRef.current = {
				position:
					Number.isFinite(stashed) && (stashed as number) > 0
						? (stashed as number)
						: position > 0
							? position
							: 0,
				shouldPlay:
					pendingResumeRef.current?.shouldPlay ?? wantPlayingRef.current,
			};
			setLoadedPath(null);
			return;
		}

		pendingResumeRef.current = null;
		stop();
		setLoadedPath(null);
	}, [path, playerRef, stop, renewing]);

	const hasDuration =
		playerRef && !isNaN(playerRef.duration) && playerRef.duration > 0;
	const showLoading =
		!error &&
		(playPending || loading || renewing || !hasDuration || loadedPath !== path);

	return {
		currentTime,
		setCurrentTime,
		error,
		showLoading,
		seekPosition,
		replay,
		forward,
		play,
		pause,
		stop,
		reloadMedia,
		pendingResumeRef,
	};
}
