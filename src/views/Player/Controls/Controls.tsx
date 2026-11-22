import { MainStore } from "@components/Main";
import MuiAlert from "@ui/Alert";
import Button from "@ui/Button";
import { usePageVisibility } from "@util/browser/hooks";
import { useMediaSession } from "@util/browser/mediaSession";
import { formatDuration } from "@util/data/string";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import styles from "./Controls.module.css";
import { SeekBar } from "./SeekBar";
import { TransportControls } from "./TransportControls";
import { useMediaPlaybackState } from "./useMediaPlaybackState";
import { usePlaybackBookmark } from "./usePlaybackBookmark";
import { useSeekBarInteraction } from "./useSeekBarInteraction";

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
}: any) {
	const progressRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const metadataRef = useRef<any>(null);
	const { direction } = MainStore.useState();

	const translations = useTranslations();
	const visible = usePageVisibility();

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

	const {
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
	} = useMediaPlaybackState({
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
	});

	const metadata = usePlaybackBookmark({
		metadataPath,
		metadataKey,
		playerRef,
		currentTime,
		setCurrentTime,
		pendingResumeRef,
	});

	useEffect(() => {
		metadataRef.current = metadata;
	}, [metadata]);

	const events = useSeekBarInteraction({
		progressRef,
		draggingRef,
		playerRef,
		currentTime,
		seekPosition,
	});

	useMediaSession({
		playerRef,
		title: sessionTitle,
		artist: capitalizedArtist,
		enabled: show && !!playerRef,
		onPause: pause,
		onStop: stop,
	});

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
				<SeekBar
					progressRef={progressRef}
					showLoading={showLoading}
					events={events}
					translations={translations}
					playerRef={playerRef}
					currentTime={currentTime}
					progressText={progressText}
					left={left}
					color={color}
					progressPosition={progressPosition}
				/>
				<TransportControls
					direction={direction}
					error={error}
					showLoading={showLoading}
					paused={playerRef.paused}
					translations={translations}
					onReplay={replay}
					onForward={forward}
					onReload={reloadMedia}
					onPlay={play}
					onPause={pause}
					onStop={stop}
					variant={variant}
				/>
			</div>
		</>
	);
}
