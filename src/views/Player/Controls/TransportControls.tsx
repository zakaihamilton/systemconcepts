import Forward10Icon from "@icons/svg/Forward10.svg";
import PauseIcon from "@icons/svg/Pause.svg";
import PlayArrowIcon from "@icons/svg/PlayArrow.svg";
import ReplayIcon from "@icons/svg/Replay.svg";
import Replay10Icon from "@icons/svg/Replay10.svg";
import StopIcon from "@icons/svg/Stop.svg";
import CircularProgress from "@ui/CircularProgress";
import clsx from "clsx";
import PlayerButton from "../Button";
import styles from "./Controls.module.css";

function PlaybackIcon({ loading, paused, loadingLabel }: any) {
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

export function TransportControls({
	direction,
	error,
	showLoading,
	paused,
	translations,
	onReplay,
	onForward,
	onReload,
	onPlay,
	onPause,
	onStop,
	variant,
}: any) {
	return (
		<div className={styles.buttons}>
			{direction === "ltr" && (
				<PlayerButton
					icon={<Replay10Icon />}
					name={translations.REPLAY}
					onClick={onReplay}
					variant={variant}
				/>
			)}
			{direction === "rtl" && (
				<PlayerButton
					icon={<Forward10Icon />}
					name={translations.FORWARD}
					onClick={onForward}
					variant={variant}
				/>
			)}
			{!!error && (
				<PlayerButton
					icon={<ReplayIcon />}
					name={translations.RELOAD}
					onClick={onReload}
					variant={variant}
				/>
			)}
			{!error && (
				<PlayerButton
					icon={
						<PlaybackIcon
							loading={showLoading}
							paused={paused}
							loadingLabel={translations.LOADING}
						/>
					}
					name={
						showLoading
							? translations.LOADING
							: paused
								? translations.PLAY
								: translations.PAUSE
					}
					onClick={paused ? onPlay : onPause}
					variant={variant}
				/>
			)}
			{!error && (
				<PlayerButton
					icon={<StopIcon />}
					name={translations.STOP}
					onClick={onStop}
					variant={variant}
				/>
			)}
			{direction === "ltr" && (
				<PlayerButton
					icon={<Forward10Icon />}
					name={translations.FORWARD}
					onClick={onForward}
					variant={variant}
				/>
			)}
			{direction === "rtl" && (
				<PlayerButton
					icon={<Replay10Icon />}
					name={translations.REPLAY}
					onClick={onReplay}
					variant={variant}
				/>
			)}
		</div>
	);
}
