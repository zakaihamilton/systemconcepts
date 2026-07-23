import Dialog from "@components/Widgets/Dialog";
import AutorenewIcon from "@icons/svg/Autorenew.svg";
import CheckIcon from "@icons/svg/Check.svg";
import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import DescriptionIcon from "@icons/svg/Description.svg";
import ErrorIcon from "@icons/svg/Error.svg";
import ExpandLessIcon from "@icons/svg/ExpandLess.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import InfoIcon from "@icons/svg/Info.svg";
import UploadIcon from "@icons/svg/Upload.svg";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { IconButton } from "@ui";
import Chip from "@ui/Chip";
import LinearProgress from "@ui/LinearProgress";
import Tab from "@ui/Tab";
import { logger as structuredLogger } from "@util/api/logger";
import { copyToClipboard, formatDuration } from "@util/data/string";
import { SessionsStore, useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { useUpdateSessions } from "@util/domain/updateSessions";
import SessionIcon from "@widgets/SessionIcon";
import Tabs from "@widgets/Tabs";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ProgressDialog.module.css";

function NewSessionItem({ session }) {
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
					{session.files.map((file, fileIdx) => (
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

function NewSessionsList({ sessions }) {
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
					{sessions.map((session, idx) => (
						<NewSessionItem key={idx} session={session} />
					))}
				</div>
			)}
		</div>
	);
}

export default function ProgressDialog() {
	const translations = useTranslations();
	const { busy, status, start, showUpdateDialog } =
		UpdateSessionsStore.useState();
	const {
		busy: syncing,
		progress: syncProgress,
		logs: syncLogs,
		needsSessionReload,
	} = SyncActiveStore.useState();

	// Fetch all sessions using useSessions hook
	const [allSessions, loadingSessions, groupMetadata] = useSessions([], {
		filterSessions: false,
		skipSync: true,
	});

	// Connect updateSessions controller
	const { updateGroup } = useUpdateSessions(groupMetadata || []);

	const wasBusyRef = useRef(false);
	const wasSyncingRef = useRef(false);
	const [currentTime, setCurrentTime] = useState(new Date().getTime());
	const [expandedItems, setExpandedItems] = useState(new Set());
	const [isListExpanded, setListExpanded] = useState(true);
	const [activeTab, setActiveTab] = useState("updates");
	const [activeSyncingSessionId, setActiveSyncingSessionId] = useState(null);
	const [syncLogCopied, setSyncLogCopied] = useState(false);

	const last50 = useMemo(() => {
		return [...(allSessions || [])]
			.sort((a, b) => b.id.localeCompare(a.id))
			.slice(0, 50);
	}, [allSessions]);

	useEffect(() => {
		if (needsSessionReload && !busy) {
			SessionsStore.update((s) => {
				s.counter++;
			});
			SyncActiveStore.update((s) => {
				s.needsSessionReload = false;
			});
		}
	}, [needsSessionReload, busy]);

	useEffect(() => {
		if (!busy) {
			setActiveSyncingSessionId(null);
		}
	}, [busy]);

	useEffect(() => {
		if (busy) {
			setCurrentTime(new Date().getTime());
			const interval = setInterval(() => {
				setCurrentTime(new Date().getTime());
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [busy]);

	useEffect(() => {
		if (busy && !wasBusyRef.current) {
			UpdateSessionsStore.update((s) => {
				s.showUpdateDialog = true;
			});
			setTimeout(() => setExpandedItems(new Set()), 0);
		}
		wasBusyRef.current = busy;
	}, [busy]);

	useEffect(() => {
		if (syncing && !wasSyncingRef.current) {
			// Keep the dialog open if sync starts
			UpdateSessionsStore.update((s) => {
				s.showUpdateDialog = true;
			});
			// Switch to log tab automatically when active background cloud sync starts
			setActiveTab("logs");
		}
		if (!syncing && wasSyncingRef.current) {
			SessionsStore.update((s) => {
				s.counter++;
			});
		}
		wasSyncingRef.current = syncing;
	}, [syncing]);

	const handleClose = () => {
		UpdateSessionsStore.update((s) => {
			s.showUpdateDialog = false;
		});
	};

	const handleUpdateSession = (session) => {
		if (updateGroup) {
			structuredLogger.debug(
				`[ProgressDialog] Requested targeted metadata update for session:`,
				{
					id: session.id,
					name: session.name,
					group: session.group,
					date: session.date,
					metadata: {
						hasTags: Array.isArray(session.tags) && session.tags.length > 0,
						hasDuration:
							typeof session.duration === "number" && session.duration > 0.5,
						hasSummary: !!session.summaryText || !!session.summary,
						hasTranscription: !!session.transcription,
						hasThumbnail: !!session.thumbnail,
					},
				},
			);
			setActiveSyncingSessionId(session.id);
			updateGroup(session.group, false, true, session.id); // updateAll = false, forceUpdate = true, targetSessionId = session.id
		}
	};

	if (!showUpdateDialog) {
		return null;
	}

	const duration = start && currentTime - start;
	const formattedDuration = formatDuration(duration);

	const visibleItems = status.filter(
		(item) => item.count > 0 || (item.errors && item.errors.length > 0),
	);
	const totalAdded = status.reduce(
		(acc, item) => acc + (item.addedCount || 0),
		0,
	);

	const toggleList = () => {
		setListExpanded(!isListExpanded);
	};

	const toggleItem = (name) => {
		const newSet = new Set(expandedItems);
		if (newSet.has(name)) {
			newSet.delete(name);
		} else {
			newSet.add(name);
		}
		setExpandedItems(newSet);
	};

	const handleCopySyncLog = () => {
		const logText = (syncLogs || []).map((log) => log.message).join("\n");
		if (!logText || !copyToClipboard(logText)) return;
		setSyncLogCopied(true);
		setTimeout(() => setSyncLogCopied(false), 1500);
	};

	return (
		<Dialog
			onClose={handleClose}
			title={translations.UPDATE_SESSIONS}
			className={styles.dialog}
		>
			<div className={styles.dialogContainer}>
				{!!duration && (
					<div className={clsx(styles.timer, busy ? styles.busy : styles.idle)}>
						<AutorenewIcon
							className={clsx(styles.timerIcon, busy && styles.rotating)}
						/>
						<div className={styles.timerText}>{formattedDuration}</div>
					</div>
				)}

				<div className={styles.tabsWrapper}>
					<Tabs state={[activeTab, setActiveTab]} className={styles.tabs}>
						<Tab
							label={
								<span className={styles.tabLabel}>
									<SessionIcon className={styles.tabIcon} />
									{translations.UPDATES || "Updates"}
								</span>
							}
							value="updates"
						/>
						<Tab
							label={
								<span className={styles.tabLabel}>
									<UploadIcon className={styles.tabIcon} />
									{translations.SYNC_LOG || "Sync Log"}
									{syncing && <span className={styles.logBadge} />}
								</span>
							}
							value="logs"
						/>
						<Tab
							label={
								<span className={styles.tabLabel}>
									<DescriptionIcon className={styles.tabIcon} />
									{"Recent (50)"}
								</span>
							}
							value="recent"
						/>
					</Tabs>
				</div>

				<div className={styles.content}>
					{activeTab === "updates" && (
						<>
							<div
								className={styles.totalAdded}
								onClick={toggleList}
								style={{
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
								}}
							>
								<span className={styles.totalAddedText} style={{ flex: 1 }}>
									{translations.TOTAL_SESSIONS_ADDED}:{" "}
									<strong className={styles.countGlow}>{totalAdded}</strong>
								</span>
								{isListExpanded ? (
									<ExpandLessIcon className={styles.expandIcon} />
								) : (
									<ExpandMoreIcon className={styles.expandIcon} />
								)}
							</div>

							{isListExpanded && (
								<div className={styles.itemsContainer}>
									{visibleItems.map((item) => (
										<ProgressItem
											key={item.name}
											item={item}
											translations={translations}
											expanded={expandedItems.has(item.name)}
											onToggle={() => toggleItem(item.name)}
										/>
									))}
									{visibleItems.length === 0 && (
										<div className={styles.empty}>
											<InfoIcon className={styles.emptyIcon} />
											<div>{translations.NO_UPDATES}</div>
										</div>
									)}
								</div>
							)}
						</>
					)}

					{activeTab === "logs" && (
						<div className={styles.syncTabContent}>
							{syncing || (syncLogs && syncLogs.length > 0) ? (
								<div className={styles.syncSection}>
									<div className={styles.syncHeader}>
										<UploadIcon className={styles.titleIcon} />
										<span style={{ flex: 1 }}>
											{translations.CLOUD_SYNC || "Cloud Sync"}
										</span>
										{syncLogs?.length > 0 && (
											<IconButton
												onClick={handleCopySyncLog}
												className={styles.copySyncLogButton}
												title={
													syncLogCopied
														? translations.LOG_COPIED || "Copied"
														: translations.COPY_LOG || "Copy log"
												}
												aria-label={translations.COPY_LOG || "Copy log"}
											>
												{syncLogCopied ? (
													<CheckIcon fontSize="small" />
												) : (
													<ContentCopyIcon fontSize="small" />
												)}
											</IconButton>
										)}
										{syncing && (
											<Chip
												label={translations.SYNCING}
												color="primary"
												size="small"
												className={styles.syncChip}
											/>
										)}
									</div>
									<div className={styles.syncContent}>
										<div className={styles.syncProgress}>
											{syncing && syncProgress && (
												<>
													<LinearProgress
														variant="determinate"
														value={
															syncProgress.total > 0
																? (syncProgress.processed /
																		syncProgress.total) *
																	100
																: 0
														}
														className={styles.progressBar}
													/>
													<div className={styles.progressText}>
														{Math.round(syncProgress.processed)} /{" "}
														{Math.round(syncProgress.total)}
													</div>
												</>
											)}
										</div>

										<div
											className={styles.syncLogs}
											ref={(el) => {
												if (el) el.scrollTop = el.scrollHeight;
											}}
										>
											{(syncLogs || []).map((log, idx) => (
												<div
													key={idx}
													className={clsx(styles.logEntry, styles[log.type])}
												>
													{log.message}
												</div>
											))}
										</div>
									</div>
								</div>
							) : (
								<div className={styles.empty}>
									<InfoIcon className={styles.emptyIcon} />
									<div>No Cloud Sync logs generated yet.</div>
								</div>
							)}
						</div>
					)}

					{activeTab === "recent" && (
						<div className={styles.recentTabContent}>
							{loadingSessions && last50.length === 0 ? (
								<div className={styles.empty}>
									<AutorenewIcon
										className={clsx(styles.emptyIcon, styles.rotating)}
									/>
									<div>Loading recent sessions...</div>
								</div>
							) : last50.length > 0 ? (
								<div className={styles.tableContainer}>
									<table className={styles.recentTable}>
										<thead>
											<tr>
												<th>Session</th>
												<th
													className={clsx(styles.centerAlign, styles.slimCol)}
												>
													Tags
												</th>
												<th
													className={clsx(styles.centerAlign, styles.slimCol)}
												>
													Duration
												</th>
												<th
													className={clsx(styles.centerAlign, styles.slimCol)}
												>
													Summary
												</th>
												<th
													className={clsx(styles.centerAlign, styles.slimCol)}
												>
													Transcript
												</th>
												<th
													className={clsx(styles.centerAlign, styles.slimCol)}
												>
													Thumbnail
												</th>
												<th
													className={clsx(styles.centerAlign, styles.actionCol)}
												>
													Action
												</th>
											</tr>
										</thead>
										<tbody>
											{last50.map((session, idx) => {
												const hasTags =
													Array.isArray(session.tags) &&
													session.tags.length > 0;
												const hasDuration =
													typeof session.duration === "number" &&
													session.duration > 0.5;
												const hasSummary =
													!!session.summaryText || !!session.summary;
												const hasTranscription = !!session.transcription;
												const hasThumbnail = !!session.thumbnail;

												const isSessionSyncing =
													busy && activeSyncingSessionId === session.id;

												return (
													<tr key={idx}>
														<td>
															<div className={styles.sessionTableTitle}>
																{session.name || session.id}
															</div>
															<div className={styles.sessionTableSub}>
																{session.group} • {session.date}
															</div>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.slimCol,
															)}
														>
															<span
																className={clsx(
																	styles.tableIndicator,
																	hasTags
																		? styles.indActive
																		: styles.indInactive,
																)}
															>
																{hasTags ? "🟢" : "⚫"}
															</span>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.slimCol,
															)}
														>
															<span
																className={clsx(
																	styles.tableIndicator,
																	hasDuration
																		? styles.indActive
																		: styles.indInactive,
																)}
															>
																{hasDuration ? "🟢" : "⚫"}
															</span>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.slimCol,
															)}
														>
															<span
																className={clsx(
																	styles.tableIndicator,
																	hasSummary
																		? styles.indActive
																		: styles.indInactive,
																)}
															>
																{hasSummary ? "🟢" : "⚫"}
															</span>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.slimCol,
															)}
														>
															<span
																className={clsx(
																	styles.tableIndicator,
																	hasTranscription
																		? styles.indActive
																		: styles.indInactive,
																)}
															>
																{hasTranscription ? "🟢" : "⚫"}
															</span>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.slimCol,
															)}
														>
															<span
																className={clsx(
																	styles.tableIndicator,
																	hasThumbnail
																		? styles.indActive
																		: styles.indInactive,
																)}
															>
																{hasThumbnail ? "🟢" : "⚫"}
															</span>
														</td>
														<td
															className={clsx(
																styles.centerAlign,
																styles.actionCol,
															)}
														>
															<IconButton
																onClick={() => handleUpdateSession(session)}
																disabled={busy}
																size="small"
																className={styles.tableActionBtn}
															>
																<AutorenewIcon
																	className={clsx(
																		styles.tableActionIcon,
																		isSessionSyncing && styles.rotating,
																	)}
																/>
															</IconButton>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<div className={styles.empty}>
									<InfoIcon className={styles.emptyIcon} />
									<div>No sessions found in the system.</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</Dialog>
	);
}

function ProgressItem({ item, translations, expanded, onToggle }) {
	const hasErrors = item.errors && item.errors.length > 0;
	const progress = item.count > 0 ? (item.progress / item.count) * 100 : 0;
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
								{item.year && `${item.year} - `}
								{item.sessionCount > 0 && item.progress < item.count
									? `${item.sessionProgress || 0} / ${item.sessionCount} sessions`
									: `${item.progress} / ${item.count} ${translations.YEARS}`}
							</span>
						</div>
					</div>
					{hasNewSessions && <NewSessionsList sessions={item.newSessions} />}
					{hasErrors && (
						<div className={styles.errors}>
							{item.errors.map((err, idx) => (
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
