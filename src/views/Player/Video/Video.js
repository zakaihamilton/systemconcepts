import { useEffect, useRef, useState } from "react";
import Controls from "../Controls";
import { PlayerStore } from "../Player";
import Toolbar from "../Toolbar";
import { useMediaUrlRenewal } from "../useMediaUrlRenewal";
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
	sessionKey,
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
	const { recovering, onError, clearRecovery } = useMediaUrlRenewal({
		path,
		renewUrl,
		renewing,
		onLoadError,
		sessionKey,
		label: "Video",
	});

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
	// NETWORK_EMPTY with no currentSrc. Controls relies on this as the single
	// load() owner for path changes.
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
						sessionKey={sessionKey}
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
