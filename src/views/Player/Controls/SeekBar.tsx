import clsx from "clsx";
import styles from "./Controls.module.css";

export function SeekBar({
	progressRef,
	showLoading,
	events,
	translations,
	playerRef,
	currentTime,
	progressText,
	left,
	color,
	progressPosition,
}: any) {
	return (
		<div className={styles.progress}>
			<div className={clsx(styles.progressLine, showLoading && styles.loading)}>
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
	);
}
