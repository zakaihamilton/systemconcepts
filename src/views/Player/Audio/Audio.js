import Group from "@components/Widgets/Group";
import { logger as structuredLogger } from "@util/api/logger";
import { useDeviceType } from "@util/browser/styles";
import { useDateFormatter } from "@util/data/locale";
import { formatDuration } from "@util/data/string";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import Controls from "../Controls";
import { PlayerStore } from "../Player";
import Toolbar from "../Toolbar";
import styles from "./Audio.module.css";

const MAX_RENEW_ATTEMPTS = 3;

export default function Audio({
	show,
	metadataPath,
	metadataKey,
	name,
	path,
	renewUrl,
	renewing,
	onLoadError,
	date,
	group,
	color,
	children,
	elements,
	showDetails,
	isTranscript,
	...props
}) {
	const isMobile = useDeviceType() !== "desktop";
	const ref = useRef();
	const [playerRef, setPlayerRef] = useState(null);
	const [duration, setDuration] = useState(0);
	const [recovering, setRecovering] = useState(false);
	const [loadedPath, setLoadedPath] = useState(null);
	const errorCountRef = useRef(0);
	const renewInFlightRef = useRef(false);
	const reportedLoadError = useRef(false);

	const onError = () => {
		// Ignore duplicate errors from the dying source while a renew is in flight.
		if (renewInFlightRef.current || renewing) {
			return;
		}
		if (errorCountRef.current < MAX_RENEW_ATTEMPTS) {
			structuredLogger.debug("Audio error, renewing URL...");
			renewInFlightRef.current = true;
			setRecovering(true);
			errorCountRef.current += 1;
			renewUrl?.();
		} else if (!reportedLoadError.current) {
			reportedLoadError.current = true;
			setRecovering(false);
			onLoadError?.();
		}
	};

	const clearRecovery = () => {
		renewInFlightRef.current = false;
		setRecovering(false);
		errorCountRef.current = 0;
		reportedLoadError.current = false;
	};

	useEffect(() => {
		// A new signed URL arrived — allow subsequent errors to renew again.
		renewInFlightRef.current = false;
	}, [path]);

	useEffect(() => {
		if (!renewing) {
			renewInFlightRef.current = false;
		}
	}, [renewing]);

	useEffect(() => {
		setPlayerRef(ref.current);
		return () => {
			setPlayerRef(null);
		};
	}, []);

	useEffect(() => {
		PlayerStore.update((s) => {
			s.player = playerRef;
		});
	}, [playerRef]);

	useEffect(() => {
		setLoadedPath(null);
	}, [path]);

	// React can add or replace the <source> after the media element has mounted.
	// Browsers do not automatically reload in that case, leaving the player in
	// NETWORK_EMPTY with no currentSrc.
	useEffect(() => {
		if (ref.current && path) {
			ref.current.load();
		}
	}, [path]);

	useEffect(() => {
		if (!playerRef) return;

		const handleDurationChange = () => {
			setDuration(playerRef.duration || 0);
			if (playerRef.duration) {
				setLoadedPath(path);
			}
		};

		// Set initial duration if already loaded
		if (playerRef.duration) {
			setTimeout(() => {
				setDuration(playerRef.duration);
				setLoadedPath(path);
			}, 0);
		}

		playerRef.addEventListener("durationchange", handleDurationChange);

		return () => {
			playerRef.removeEventListener("durationchange", handleDurationChange);
		};
	}, [playerRef, path]);

	useEffect(() => {
		if (ref.current) {
			const tracks = ref.current.textTracks;
			if (tracks && tracks[0]) {
				tracks[0].mode = "showing";
			}
		}
	}, [children]);

	const dateFormatter = useDateFormatter({
		weekday: "long",
		year: "numeric",
		month: isMobile ? "short" : "long",
		day: "numeric",
	});

	let dateWidget = "";
	try {
		dateWidget = date && dateFormatter.format(new Date(date));
	} catch (err) {
		structuredLogger.error("err", err);
	}

	const { style, ...rest } = props;
	return (
		<div className={styles.root} style={style}>
			<div className={clsx(styles.container, !showDetails && styles.collapsed)}>
				<div
					className={clsx(
						styles.card,
						(renewing || recovering || !duration || loadedPath !== path) &&
							styles.loading,
					)}
					style={{ "--group-color": color }}
				>
					<div className={styles.header}>
						<div className={styles.headerRow}>
							<div className={styles.title}>{name}</div>
						</div>
						<div className={styles.metadata}>
							<Group fill={false} name={group} color={color} />
							<span className={styles.date}>{dateWidget}</span>
							{duration > 1 && (
								<span className={styles.duration}>
									{formatDuration(duration * 1000, true)}
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
			{elements}
			<video
				ref={ref}
				className={clsx(styles.video, isTranscript && styles.hidden)}
				{...rest}
				playsInline
				onError={onError}
				onLoadedMetadata={clearRecovery}
				onPlaying={clearRecovery}
			>
				{children}
			</video>
			{playerRef && (
				<Controls
					playerRef={playerRef}
					color={color}
					noDuration={true}
					metadataPath={metadataPath}
					metadataKey={metadataKey}
					path={path}
					show={show}
					zIndex={1}
					sessionName={name}
					groupName={group}
					sessionDate={date}
					renewing={renewing || recovering}
					renewUrl={renewUrl}
				/>
			)}
			{playerRef && (
				<Toolbar
					show={show}
					name={name}
					playerRef={playerRef}
					isVideo={false}
				/>
			)}
		</div>
	);
}
