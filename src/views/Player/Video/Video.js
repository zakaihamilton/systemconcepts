import { logger as structuredLogger } from "@util/api/logger";
import { useEffect, useRef, useState } from "react";
import Controls from "../Controls";
import { PlayerStore } from "../Player";
import Toolbar from "../Toolbar";
import styles from "./Video.module.css";

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
	const [errorCount, setErrorCount] = useState(0);
	const [recovering, setRecovering] = useState(false);
	const reportedLoadError = useRef(false);

	const onError = () => {
		if (errorCount < 3) {
			structuredLogger.debug("Video error, renewing URL...");
			setRecovering(true);
			renewUrl();
			setErrorCount((count) => count + 1);
		} else if (!reportedLoadError.current) {
			reportedLoadError.current = true;
			onLoadError?.();
		}
	};

	const clearRecovery = () => {
		setRecovering(false);
		setErrorCount(0);
		reportedLoadError.current = false;
	};

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
