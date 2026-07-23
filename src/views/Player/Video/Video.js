import { logger as structuredLogger } from "@util/api/logger";
import { useEffect, useRef, useState } from "react";
import Controls from "../Controls";
import { PlayerStore } from "../Player";
import Toolbar from "../Toolbar";
import styles from "./Video.module.css";

const MAX_RENEW_ATTEMPTS = 3;

export default function Video({
	show,
	metadataPath,
	metadataKey,
	name,
	path,
	renewUrl,
	renewing,
	onLoadError,
	color,
	group,
	children,
	elements,
	showDetails: _showDetails,
	isTranscript: _isTranscript,
	...props
}) {
	const ref = useRef();
	const { style, className, ...videoProps } = props;
	const [playerRef, setPlayerRef] = useState(null);
	const [recovering, setRecovering] = useState(false);
	const errorCountRef = useRef(0);
	const renewInFlightRef = useRef(false);
	const reportedLoadError = useRef(false);

	const onError = () => {
		// Ignore duplicate errors from the dying source while a renew is in flight.
		if (renewInFlightRef.current || renewing) {
			return;
		}
		if (errorCountRef.current < MAX_RENEW_ATTEMPTS) {
			structuredLogger.debug("Video error, renewing URL...");
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
	// React can add or replace the <source> after the media element has mounted.
	// Browsers do not automatically reload in that case, leaving the player in
	// NETWORK_EMPTY with no currentSrc.
	useEffect(() => {
		if (ref.current && path) {
			ref.current.load();
		}
	}, [path]);
	return (
		<div className={styles.root} style={style}>
			<video
				ref={ref}
				className={className ? `${styles.video} ${className}` : styles.video}
				{...videoProps}
				playsInline
				onError={onError}
				onLoadedMetadata={clearRecovery}
				onPlaying={clearRecovery}
			>
				{children}
			</video>
			{elements}
			<div className={styles.controls}>
				{playerRef && (
					<Controls
						playerRef={playerRef}
						color={color}
						metadataPath={metadataPath}
						metadataKey={metadataKey}
						path={path}
						show={show}
						sessionName={name}
						groupName={group}
						renewing={renewing || recovering}
						renewUrl={renewUrl}
						variant="video"
					/>
				)}
				{playerRef && (
					<Toolbar
						show={show}
						name={name}
						playerRef={playerRef}
						isVideo={true}
					/>
				)}
			</div>
		</div>
	);
}
