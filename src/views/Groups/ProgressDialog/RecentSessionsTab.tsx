import AutorenewIcon from "@icons/svg/Autorenew.svg";
import InfoIcon from "@icons/svg/Info.svg";
import { IconButton } from "@ui";
import clsx from "clsx";
import styles from "./RecentSessionsTab.module.css";

interface RecentSessionsTabProps {
	loadingSessions: boolean;
	sessions: any[];
	busy: boolean;
	activeSyncingSessionId: string | null;
	onUpdateSession: (session: any) => void;
}

const INDICATOR_HEADERS = [
	"Tags",
	"Duration",
	"Summary",
	"Transcript",
	"Thumbnail",
];

/**
 * Displays the 50 most recent sessions with metadata readiness indicators
 * and per-session targeted sync triggers.
 */
export default function RecentSessionsTab({
	loadingSessions,
	sessions,
	busy,
	activeSyncingSessionId,
	onUpdateSession,
}: RecentSessionsTabProps) {
	return (
		<div className={styles.recentTabContent}>
			{loadingSessions && sessions.length === 0 ? (
				<div className={styles.empty}>
					<AutorenewIcon className={clsx(styles.emptyIcon, styles.rotating)} />
					<div>Loading recent sessions...</div>
				</div>
			) : sessions.length > 0 ? (
				<div className={styles.tableContainer}>
					<table className={styles.recentTable}>
						<thead>
							<tr>
								<th>Session</th>
								{INDICATOR_HEADERS.map((heading) => (
									<th
										key={heading}
										className={clsx(styles.centerAlign, styles.slimCol)}
									>
										{heading}
									</th>
								))}
								<th className={clsx(styles.centerAlign, styles.actionCol)}>
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{sessions.map((session, idx) => {
								const indicators = [
									Array.isArray(session.tags) && session.tags.length > 0,
									typeof session.duration === "number" &&
										session.duration > 0.5,
									!!session.summaryText || !!session.summary,
									!!session.transcription,
									!!session.thumbnail,
								];
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
										{indicators.map((active, indIdx) => (
											<td
												key={indIdx}
												className={clsx(styles.centerAlign, styles.slimCol)}
											>
												<span
													className={clsx(
														styles.tableIndicator,
														active ? styles.indActive : styles.indInactive,
													)}
												>
													{active ? "🟢" : "⚫"}
												</span>
											</td>
										))}
										<td className={clsx(styles.centerAlign, styles.actionCol)}>
											<IconButton
												onClick={() => onUpdateSession(session)}
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
	);
}
