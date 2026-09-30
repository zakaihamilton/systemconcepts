import AutorenewIcon from "@icons/svg/Autorenew.svg";
import CheckIcon from "@icons/svg/Check.svg";
import DescriptionIcon from "@icons/svg/Description.svg";
import ErrorIcon from "@icons/svg/Error.svg";
import ExpandLessIcon from "@icons/svg/ExpandLess.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import Chip from "@ui/Chip";
import LinearProgress from "@ui/LinearProgress";
import { useTranslations } from "@util/domain/translations";
import SessionIcon from "@widgets/SessionIcon";
import clsx from "clsx";
import { useState } from "react";
import styles from "./ProgressDialog.module.css";

function NewSessionItem({ session }: any) {
	const [expanded, setExpanded] = useState(false);
	const metadata = session.metadata || {};

	return (
		<div className={clsx(styles.sessionItem, expanded && styles.expanded)}>
			<div
				className={styles.sessionName}
				onClick={() => setExpanded(!expanded)}
				style={{ cursor: "pointer" }}
			>
				<SessionIcon className={styles.sessionIcon} />
				<span className={styles.sessionTitle}>{session.name}</span>
				{expanded ? (
					<ExpandLessIcon className={styles.expandIcon} />
				) : (
					<ExpandMoreIcon className={styles.expandIcon} />
				)}
			</div>

			<div className={styles.metadataBadges}>
				<span
					className={clsx(
						styles.badge,
						metadata.hasTags ? styles.badgeActive : styles.badgeInactive,
					)}
				>
					{metadata.hasTags ? "🟢" : "⚫"} Tags
				</span>
				<span
					className={clsx(
						styles.badge,
						metadata.hasDuration ? styles.badgeActive : styles.badgeInactive,
					)}
				>
					{metadata.hasDuration ? "🟢" : "⚫"} Duration
				</span>
				<span
					className={clsx(
						styles.badge,
						metadata.hasSummary ? styles.badgeActive : styles.badgeInactive,
					)}
				>
					{metadata.hasSummary ? "🟢" : "⚫"} Summary
				</span>
				<span
					className={clsx(
						styles.badge,
						metadata.hasTranscription
							? styles.badgeActive
							: styles.badgeInactive,
					)}
				>
					{metadata.hasTranscription ? "🟢" : "⚫"} Transcript
				</span>
				<span
					className={clsx(
						styles.badge,
						metadata.hasThumbnail ? styles.badgeActive : styles.badgeInactive,
					)}
				>
					{metadata.hasThumbnail ? "🟢" : "⚫"} Thumbnail
				</span>
			</div>

			{expanded && (
				<div className={styles.sessionFiles}>
					{session.files.map((file: any, fileIdx: any) => (
						<div key={fileIdx} className={styles.fileName}>
							<DescriptionIcon className={styles.fileIcon} />
							{file}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function NewSessionsList({ sessions }: any) {
	const translations = useTranslations();
	const [expanded, setExpanded] = useState(true);

	return (
		<div className={styles.newSessions}>
			<div
				className={styles.newSessionsTitle}
				onClick={() => setExpanded(!expanded)}
				style={{ cursor: "pointer" }}
			>
				<SessionIcon className={styles.titleIcon} />
				<span style={{ flex: 1 }}>
					{translations.NEW_SESSIONS} ({sessions.length})
				</span>
				{expanded ? (
					<ExpandLessIcon className={styles.expandIcon} />
				) : (
					<ExpandMoreIcon className={styles.expandIcon} />
				)}
			</div>
			{expanded && (
				<div className={styles.sessionsList}>
					{sessions.map((session: any, idx: any) => (
						<NewSessionItem key={idx} session={session} />
					))}
				</div>
			)}
		</div>
	);
}

function getItemProgressPercent(item: any) {
	if (item.phase === "persisting") {
		return 100;
	}
	if (
		(item.phase === "sessions" || item.phase === "metadata") &&
		item.sessionCount > 0
	) {
		return ((item.sessionProgress || 0) / item.sessionCount) * 100;
	}
	if (item.count > 0) {
		return (item.progress / item.count) * 100;
	}
	return 0;
}

function getItemProgressLabel(item: any, translations: any) {
	if (item.phase === "metadata") {
		return translations.LOADING_METADATA || "Loading metadata…";
	}
	if (item.phase === "persisting") {
		const yearPrefix = item.year ? `${item.year} - ` : "";
		return yearPrefix + (translations.SAVING_SESSIONS || "Saving sessions…");
	}
	if (item.sessionCount > 0 && item.progress < item.count) {
		const yearPrefix = item.year ? `${item.year} - ` : "";
		return `${yearPrefix}${item.sessionProgress || 0} / ${item.sessionCount} sessions`;
	}
	return `${item.progress} / ${item.count} ${translations.YEARS}`;
}

function ProgressItem({ item, translations, expanded, onToggle }: any) {
	const hasErrors = item.errors && item.errors.length > 0;
	const progress = getItemProgressPercent(item);
	const isDone = item.count > 0 && item.progress === item.count;
	const hasNewSessions = item.newSessions && item.newSessions.length > 0;

	return (
		<div
			key={item.name}
			className={clsx(styles.item, expanded && styles.itemExpanded)}
		>
			<div
				className={styles.header}
				onClick={onToggle}
				style={{ cursor: "pointer" }}
			>
				<div className={styles.statusIcon}>
					{hasErrors ? (
						<ErrorIcon className={styles.errorIconColor} />
					) : isDone ? (
						<CheckIcon className={styles.successIconColor} />
					) : (
						<AutorenewIcon
							className={clsx(styles.syncIconColor, styles.rotating)}
						/>
					)}
				</div>
				<div className={styles.name}>{item.name}</div>
				<div style={{ flex: 1 }} />
				<div className={styles.headerSummary}>
					{item.addedCount > 0 && (
						<Chip
							label={`+${item.addedCount}`}
							size="small"
							className={styles.addedCountChip}
						/>
					)}
					{expanded ? (
						<ExpandLessIcon className={styles.expandIcon} />
					) : (
						<ExpandMoreIcon className={styles.expandIcon} />
					)}
				</div>
			</div>
			{expanded && (
				<div className={styles.itemExpandedContent}>
					<div className={styles.progressContainer}>
						<LinearProgress
							variant="determinate"
							value={progress}
							className={styles.itemProgressBar}
							classes={{
								bar: hasErrors
									? styles.progressBarError
									: styles.progressBarNormal,
							}}
						/>
						<div className={styles.progressText}>
							{item.removedCount > 0 && (
								<Chip
									label={`-${item.removedCount}`}
									size="small"
									className={styles.removedCountChip}
								/>
							)}
							<div style={{ flex: 1 }} />
							<span className={styles.progressDetails}>
								{getItemProgressLabel(item, translations)}
							</span>
						</div>
					</div>
					{hasNewSessions && <NewSessionsList sessions={item.newSessions} />}
					{hasErrors && (
						<div className={styles.errors}>
							{item.errors.map((err: any, idx: any) => (
								<div key={idx} className={styles.error}>
									<ErrorIcon className={styles.inlineErrorIcon} />
									{err.toString()}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default ProgressItem;
