import ExpandMoreIcon from "@icons/ExpandMore";
import PauseIcon from "@icons/Pause";
import PlayArrowIcon from "@icons/PlayArrow";
import RecordVoiceOverIcon from "@icons/RecordVoiceOver";
import SkipNextIcon from "@icons/SkipNext";
import SkipPreviousIcon from "@icons/SkipPrevious";
import StopIcon from "@icons/Stop";
import Box from "@ui/Box";
import Button from "@ui/Button";
import IconButton from "@ui/IconButton";
import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import Paper from "@ui/Paper";
import Typography from "@ui/Typography";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import styles from "./Controls.module.css";
export default function Controls({
	translations,
	isPlaying,
	currentParagraphIndex,
	paragraphs,
	voices,
	selectedVoice,
	voiceMenuAnchor,
	isCollapsed,
	setIsCollapsed,
	handlePrevious,
	handlePlay,
	handlePause,
	handleStop,
	handleNext,
	handleVoiceMenuOpen,
	handleVoiceMenuClose,
	handleVoiceSelect,
}) {
	const voiceTooltip = (
		<span className={styles.voiceTooltip}>
			<b> Voice</b>
			{selectedVoice?.name || ""}
		</span>
	);
	return (
		<>
			<Paper
				className={`${styles.root} ${!isCollapsed ? styles.expanded : ""} ${isCollapsed ? styles.collapsed : ""} ${isPlaying ? styles.playing : ""} print-hidden`}
				elevation={0}
			>
				<Box
					className={styles.controls}
					role="group"
					aria-label="Player controls"
				>
					{!isCollapsed && (
						<>
							<Tooltip title={translations.PREVIOUS_PARAGRAPH} arrow>
								<span>
									<IconButton
										onClick={handlePrevious}
										disabled={currentParagraphIndex <= 0}
										className={styles.controlButton}
										aria-label={translations.PREVIOUS_PARAGRAPH}
									>
										<SkipPreviousIcon />
									</IconButton>
								</span>
							</Tooltip>

							{!isPlaying ? (
								<Tooltip title={translations.PLAY} arrow>
									<IconButton
										onClick={handlePlay}
										className={`${styles.controlButton} ${styles.playButton}`}
										aria-label={translations.PLAY}
									>
										<PlayArrowIcon />
									</IconButton>
								</Tooltip>
							) : (
								<Tooltip title={translations.PAUSE} arrow>
									<IconButton
										onClick={handlePause}
										className={`${styles.controlButton} ${styles.playButton}`}
										aria-label={translations.PAUSE}
									>
										<PauseIcon />
									</IconButton>
								</Tooltip>
							)}

							<Tooltip title={translations.STOP} arrow>
								<span>
									<IconButton
										onClick={handleStop}
										disabled={!isPlaying && currentParagraphIndex < 0}
										className={styles.controlButton}
										aria-label={translations.STOP}
									>
										<StopIcon />
									</IconButton>
								</span>
							</Tooltip>

							<Tooltip title={translations.NEXT_PARAGRAPH} arrow>
								<span>
									<IconButton
										onClick={handleNext}
										disabled={currentParagraphIndex >= paragraphs.length - 1}
										className={styles.controlButton}
										aria-label={translations.NEXT_PARAGRAPH}
									>
										<SkipNextIcon />
									</IconButton>
								</span>
							</Tooltip>

							<Tooltip title={voiceTooltip} arrow>
								<IconButton
									onClick={handleVoiceMenuOpen}
									className={styles.controlButton}
									aria-label="Select voice"
								>
									<RecordVoiceOverIcon />
								</IconButton>
							</Tooltip>

							<Menu
								anchorEl={voiceMenuAnchor}
								open={Boolean(voiceMenuAnchor)}
								onClose={handleVoiceMenuClose}
								className={styles.voiceMenu}
								aria-label="Available voices"
							>
								{voices
									.filter((voice) => voice.lang.startsWith("en-"))
									.map((voice, index) => (
										<MenuItem
											key={index}
											onClick={() => handleVoiceSelect(voice)}
											selected={selectedVoice?.name === voice.name}
											aria-label={`Select ${voice.name}`}
											className={clsx(
												styles.voiceMenuItem,
												selectedVoice?.name === voice.name &&
													styles.voiceMenuItemSelected,
											)}
										>
											<Typography
												variant="body2"
												className={
													selectedVoice?.name === voice.name
														? styles.voiceNameSelected
														: styles.voiceName
												}
											>
												{voice.name}
											</Typography>
										</MenuItem>
									))}
							</Menu>

							<Tooltip title={translations.COLLAPSE} arrow>
								<IconButton
									onClick={() => setIsCollapsed(true)}
									className={styles.controlButton}
									size="small"
									aria-label={translations.COLLAPSE}
								>
									<ExpandMoreIcon />
								</IconButton>
							</Tooltip>
						</>
					)}
				</Box>
			</Paper>

			{/* Collapse/Expand button on the right side */}
			{isCollapsed && (
				<Button
					variant="text"
					onClick={() => setIsCollapsed(false)}
					className={`${styles.expandButton} print-hidden`}
					size="small"
				>
					{translations.PLAYER}
				</Button>
			)}
		</>
	);
}
