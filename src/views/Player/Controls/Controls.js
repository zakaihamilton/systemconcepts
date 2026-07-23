import { MainStore } from "@components/Main";
import Forward10Icon from "@icons/svg/Forward10.svg";
import PauseIcon from "@icons/svg/Pause.svg";
import PlayArrowIcon from "@icons/svg/PlayArrow.svg";
import ReplayIcon from "@icons/svg/Replay.svg";
import Replay10Icon from "@icons/svg/Replay10.svg";
import StopIcon from "@icons/svg/Stop.svg";
import MuiAlert from "@ui/Alert";
import Button from "@ui/Button";
import CircularProgress from "@ui/CircularProgress";
import { logger as structuredLogger } from "@util/api/logger";
import { usePageVisibility } from "@util/browser/hooks";
import { useMediaSession } from "@util/browser/mediaSession";
import { formatDuration } from "@util/data/string";
import { useTranslations } from "@util/domain/translations";
import { useFile } from "@util/storage/storage";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import PlayerButton from "../Button";
import styles from "./Controls.module.css";

const skipPoints = 10;
const PLAY_LOADING_DELAY_MS = 150;

function PlaybackIcon({ loading, paused, loadingLabel }) {
	return (
		<span className={clsx(styles.playbackIcon, loading && styles.isLoading)}>
			<CircularProgress
				className={styles.loadingIndicator}
				size={24}
				aria-label={loadingLabel}
				aria-hidden={!loading}
			/>
			<span className={styles.playbackSymbol} aria-hidden={loading}>
				{paused ? <PlayArrowIcon /> : <PauseIcon />}
			</span>
		</span>
	);
}

export default function Controls({
	show,
	path,
	playerRef,
	metadataPath,
	metadataKey,
	zIndex,
	color,
	noDuration,
	sessionName,
	groupName,
	sessionDate,
	sessionKey,
	renewing,
	renewUrl,
	variant,
}) {
	const progressRef = useRef(null);
	const { direction } = MainStore.useState();

	const translations = useTranslations();
	const dragging = useRef(false);
	const [, setCounter] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [error, setError] = useState(null);
	const errorTimeoutRef = useRef(null);
	const visible = usePageVisibility();
	const [loading, setLoading] = useState(false);
	const [playPending, setPlayPending] = useState(false);
	const playPendingTimeoutRef = useRef(null);
	const playRequestedRef = useRef(false);
	// When a signed playing URL is renewed, preserve position + resume playback
	// instead of treating the new URL as a brand-new session.
	const pendingResumeRef = useRef(null);
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
	const hasDuration =
		playerRef && !isNaN(playerRef.duration) && playerRef.duration > 0;
	const showLoading =
		!error &&
		(playPending || loading || renewing || !hasDuration || loadedPath !== path);

	// MediaSession API integration for iOS Bluetooth headset controls
	// Capitalize first letter of artist name
	const capitalizedArtist = groupName
		? groupName.charAt(0).toUpperCase() + groupName.slice(1)
		: "";
	// Include date in title if available (YYYY-MM-DD format, before session name)
	const formattedDate = sessionDate
		? new Date(sessionDate).toISOString().split("T")[0]
		: null;
	const sessionTitle = formattedDate
		? `${formattedDate} ${sessionName || "Session"}`
		: sessionName || "Session";
	const [metadata, , , setMetadata] = useFile(
		metadataPath,
		[metadataPath, metadataKey],
		(data) => {
			return data ? JSON.parse(data) : {};
		},
	);

	const stateRef = useRef({ visible, show, metadata, path });
	useEffect(() => {
		stateRef.current = { visible, show, metadata, path };
	}, [visible, show, metadata, path]);

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
		playerRef.play().catch((err) => {
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
		const update = (name) => {
			if (name === "error") {
				if (renewing) {
					clearPendingError();
					return;
				}
				// Media errors often emit pause next. Stash resume intent now so that
				// pause cannot clear wantPlaying before URL renew/path change runs.
				if (!pendingResumeRef.current) {
					const position =
						Number.isFinite(playerRef.currentTime) && playerRef.currentTime > 0
							? playerRef.currentTime
							: currentTimeRef.current;
					pendingResumeRef.current = {
						position: position > 0 ? position : 0,
						shouldPlay: wantPlayingRef.current,
					};
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
						playerRef.currentTime = resume.position; // eslint-disable-line react-hooks/immutability
						setCurrentTime(resume.position);
						currentTimeRef.current = resume.position;
					}
					return;
				}
				if (!metadataKey) return; // Skip if metadataKey not ready
				const currentMetadata = metadataKey
					? stateRef.current.metadata?.[metadataKey] || {}
					: stateRef.current.metadata || {};
				if (currentMetadata.position) {
					playerRef.currentTime = currentMetadata.position; // eslint-disable-line react-hooks/immutability
					setCurrentTime(playerRef.currentTime);
				}
			}
			if (name === "timeupdate" && !dragging.current) {
				const currentTime = parseInt(playerRef.currentTime);

				if (stateRef.current.visible && stateRef.current.show) {
					// When visible, update on every timeupdate
					setCurrentTime(currentTime);
					lastUpdateTimeRef.current = currentTime;
				} else {
					// When not visible, only update every 10 seconds
					if (Math.abs(currentTime - lastUpdateTimeRef.current) >= 10) {
						setCurrentTime(currentTime);
						lastUpdateTimeRef.current = currentTime;
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
	}, [playerRef, metadataKey, renewing, clearPlayPending, beginPlay]);

	useEffect(() => {
		if (renewing && errorTimeoutRef.current) {
			clearTimeout(errorTimeoutRef.current);
			errorTimeoutRef.current = null;
			setError(null);
		}
	}, [renewing]);

	useEffect(() => {
		structuredLogger.debug("[Controls] Metadata effect triggered", {
			hasMetadata: !!metadata,
			metadataKey,
			readyState: playerRef?.readyState,
			currentTime: playerRef?.currentTime,
		});

		if (!metadataKey) return; // Skip if metadataKey not ready
		// A pending signed-URL renew owns position restore; don't apply bookmarks.
		if (pendingResumeRef.current) return;
		if (metadata && playerRef && playerRef.readyState >= 1) {
			const currentMetadata = metadataKey
				? metadata?.[metadataKey] || {}
				: metadata || {};
			structuredLogger.debug("[Controls] Current metadata:", {
				metadataKey,
				currentMetadata,
				position: currentMetadata.position,
				hasMetadataKey: !!metadataKey,
				metadataKeys: Object.keys(metadata).slice(0, 5),
			});

			if (currentMetadata.position && playerRef.currentTime < 1) {
				playerRef.currentTime = currentMetadata.position; // eslint-disable-line react-hooks/immutability
				setCurrentTime(currentMetadata.position);
			} else {
				structuredLogger.debug("[Controls] Not setting position:", {
					hasPosition: !!currentMetadata.position,
					currentTime: playerRef.currentTime,
				});
			}
		}
	}, [metadata, metadataKey, playerRef]);
	const seekPosition = useCallback(
		(position) => {
			if (isNaN(position)) {
				return;
			}
			playerRef.currentTime = position; // eslint-disable-line react-hooks/immutability
			setCurrentTime(position);
		},
		[playerRef],
	);
	const replay = () => {
		let position = currentTime;
		if (position > skipPoints) {
			position -= skipPoints;
		} else {
			position = 0;
		}
		seekPosition(position);
	};
	const forward = () => {
		let position = currentTime;
		if (position > playerRef.duration - skipPoints) {
			position = playerRef.duration;
		} else {
			position += skipPoints;
		}
		seekPosition(position);
	};
	const left = (currentTime / playerRef.duration) * 100;
	const audioPos = isNaN(currentTime) ? 0 : currentTime;
	let progressText = formatDuration(audioPos * 1000);
	if (!isNaN(playerRef.duration)) {
		if (!noDuration) {
			progressText += " / " + formatDuration(playerRef.duration * 1000);
		}
		progressText +=
			" ( " +
			translations.TIME_LEFT +
			" " +
			formatDuration((playerRef.duration - audioPos) * 1000) +
			" )";
	}
	const progressPosition = left + "%";
	const handlePosEvent = useCallback(
		(e) => {
			// Extract clientX from either mouse or touch event
			const clientX =
				e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
			if (!dragging.current || !clientX) {
				return;
			}
			const width = progressRef.current.clientWidth;
			let coord = clientX - progressRef.current.getBoundingClientRect().left;
			const ratio = playerRef.duration / width;
			let position = coord * ratio;
			if (position < 0) {
				position = 0;
			}
			if (position >= playerRef.duration) {
				position = playerRef.duration;
			}
			seekPosition(position);
		},
		[playerRef, seekPosition],
	);
	useEffect(() => {
		const handleUpEvent = (e) => {
			handlePosEvent(e);
			dragging.current = false;
		};

		// Wrapper for touch events to prevent default only when dragging
		const handleTouchMove = (e) => {
			if (dragging.current) {
				e.preventDefault();
				handlePosEvent(e);
			}
		};

		const handleTouchEnd = (e) => {
			if (dragging.current) {
				e.preventDefault();
				handleUpEvent(e);
			}
		};

		// Add both mouse and touch event listeners
		document.addEventListener("mousemove", handlePosEvent);
		document.addEventListener("mouseup", handleUpEvent);
		document.addEventListener("touchmove", handleTouchMove, { passive: false });
		document.addEventListener("touchend", handleTouchEnd, { passive: false });
		return () => {
			document.removeEventListener("mousemove", handlePosEvent);
			document.removeEventListener("mouseup", handleUpEvent);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
		};
	}, [handlePosEvent]);
	useEffect(() => {
		if (
			currentTime &&
			!isNaN(currentTime) &&
			playerRef.duration &&
			metadataKey
		) {
			setMetadata((data) => {
				if (!data) {
					data = {};
				}
				const duration = parseInt(playerRef && playerRef.duration);
				const position = parseInt(currentTime);

				if (metadataKey) {
					const subData = data[metadataKey] || {};
					subData.duration = duration;
					subData.position = position;
					return { ...data, [metadataKey]: subData };
				}

				data.duration = duration;
				data.position = position;
				return { ...data };
			});
		}
	}, [currentTime, playerRef, setMetadata, metadataKey]);
	const events = {
		onMouseDown(e) {
			dragging.current = true;
			handlePosEvent(e);
		},
		onTouchStart(e) {
			// Don't call preventDefault here - it's handled in document-level listeners
			dragging.current = true;
			handlePosEvent(e);
		},
		onKeyDown(e) {
			const duration = playerRef.duration;
			if (!duration) return;

			let newPos = currentTime;
			let changed = false;

			switch (e.key) {
				case "ArrowLeft":
				case "ArrowDown":
					newPos = Math.max(0, currentTime - skipPoints);
					changed = true;
					break;
				case "ArrowRight":
				case "ArrowUp":
					newPos = Math.min(duration, currentTime + skipPoints);
					changed = true;
					break;
				case "Home":
					newPos = 0;
					changed = true;
					break;
				case "End":
					newPos = duration;
					changed = true;
					break;
			}

			if (changed) {
				e.preventDefault();
				seekPosition(newPos);
			}
		},
		onContextMenu(e) {
			e.preventDefault(); // Prevent right-click menu
		},
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
		playerRef.currentTime = 0; // eslint-disable-line react-hooks/immutability
		setCurrentTime(0);
	}, [playerRef, clearPlayPending]);

	useMediaSession({
		playerRef,
		title: sessionTitle,
		artist: capitalizedArtist,
		enabled: show && !!playerRef,
		onPause: pause,
		onStop: stop,
	});

	const reloadMedia = useCallback(() => {
		const position =
			Number.isFinite(playerRef.currentTime) && playerRef.currentTime > 0
				? playerRef.currentTime
				: currentTimeRef.current;
		pendingResumeRef.current = {
			position: position > 0 ? position : 0,
			shouldPlay: wantPlayingRef.current,
		};
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
					Number.isFinite(stashed) && stashed > 0
						? stashed
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

	return (
		<>
			{error && (
				<MuiAlert
					className={styles.error}
					elevation={6}
					variant="filled"
					severity="error"
					action={
						<Button variant="contained" onClick={reloadMedia} size="small">
							{translations.RELOAD}
						</Button>
					}
				>
					{translations[error]}
				</MuiAlert>
			)}
			<div
				className={clsx(styles.root, variant === "video" && styles.video)}
				style={{ zIndex }}
			>
				<div className={styles.progress}>
					<div
						className={clsx(styles.progressLine, showLoading && styles.loading)}
					>
						<div
							className={styles.progressBack}
							ref={progressRef}
							{...events}
							tabIndex={0}
							role="slider"
							aria-label={translations.SEEK}
							aria-valuemin={0}
							aria-valuemax={playerRef.duration || 0}
							aria-valuenow={currentTime}
							aria-valuetext={progressText}
						/>
						<div className={styles.progressText}>{progressText}</div>
						<div
							className={styles.progressPlayed}
							style={{ width: left + "%", backgroundColor: color }}
						/>
						<div
							className={styles.progressPosition}
							style={{ left: progressPosition, backgroundColor: color }}
						/>
					</div>
				</div>
				<div className={styles.buttons}>
					{direction === "ltr" && (
						<PlayerButton
							icon={<Replay10Icon />}
							name={translations.REPLAY}
							onClick={replay}
							variant={variant}
						/>
					)}
					{direction === "rtl" && (
						<PlayerButton
							icon={<Forward10Icon />}
							name={translations.FORWARD}
							onClick={forward}
							variant={variant}
						/>
					)}
					{!!error && (
						<PlayerButton
							icon={<ReplayIcon />}
							name={translations.RELOAD}
							onClick={reloadMedia}
							variant={variant}
						/>
					)}
					{!error && (
						<PlayerButton
							icon={
								<PlaybackIcon
									loading={showLoading}
									paused={playerRef.paused}
									loadingLabel={translations.LOADING}
								/>
							}
							name={
								showLoading
									? translations.LOADING
									: playerRef.paused
										? translations.PLAY
										: translations.PAUSE
							}
							onClick={playerRef.paused ? play : pause}
							variant={variant}
						/>
					)}
					{!error && (
						<PlayerButton
							icon={<StopIcon />}
							name={translations.STOP}
							onClick={stop}
							variant={variant}
						/>
					)}
					{direction === "ltr" && (
						<PlayerButton
							icon={<Forward10Icon />}
							name={translations.FORWARD}
							onClick={forward}
							variant={variant}
						/>
					)}
					{direction === "rtl" && (
						<PlayerButton
							icon={<Replay10Icon />}
							name={translations.REPLAY}
							onClick={replay}
							variant={variant}
						/>
					)}
				</div>
			</div>
		</>
	);
}
