import CheckIcon from "@icons/svg/Check.svg";
import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import InfoIcon from "@icons/svg/Info.svg";
import UploadIcon from "@icons/svg/Upload.svg";
import { IconButton } from "@ui";
import Chip from "@ui/Chip";
import LinearProgress from "@ui/LinearProgress";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import { useLayoutEffect, useRef } from "react";
import styles from "./ProgressDialog.module.css";

export default function SyncLogPanel({
	syncing,
	syncProgress,
	syncLogs,
	copyStatus,
	logNotice,
	onCopy,
}: {
	syncing: boolean;
	syncProgress?: { processed: number; total: number };
	syncLogs: { message: string; type: string }[];
	copyStatus: "idle" | "copied" | "error";
	logNotice: string;
	onCopy: () => void;
}) {
	const translations = useTranslations();
	const logRef = useRef<HTMLDivElement>(null);
	const followLog = useRef(true);
	useLayoutEffect(() => {
		const el = logRef.current;
		if (el && followLog.current) el.scrollTop = el.scrollHeight;
	}, [syncLogs, syncing]);
	return (
		<div className={styles.syncTabContent}>
			{syncing || (syncLogs && syncLogs.length > 0) ? (
				<div className={styles.syncSection}>
					<div className={styles.syncHeader}>
						<UploadIcon className={styles.titleIcon} />
						<span style={{ flex: 1 }}>
							{translations.UPDATE_LOG || "Update log"}
						</span>
						{syncLogs?.length > 0 && (
							<IconButton
								onClick={onCopy}
								className={styles.copySyncLogButton}
								title={
									copyStatus === "copied"
										? translations.LOG_COPIED || "Copied"
										: translations.COPY_LOG || "Copy log"
								}
								aria-label={translations.COPY_LOG || "Copy log"}
							>
								{copyStatus === "copied" ? (
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
					<div role="status" className={styles.copyStatus}>
						{copyStatus === "copied"
							? translations.LOG_COPIED || "Log copied"
							: copyStatus === "error"
								? translations.LOG_COPY_FAILED || "Could not copy log"
								: ""}
					</div>
					<div className={styles.syncContent}>
						<p className={styles.logNotice}>{logNotice}</p>
						<div className={styles.syncProgress}>
							{syncing && syncProgress && (
								<>
									<LinearProgress
										variant="determinate"
										value={
											syncProgress.total > 0
												? (syncProgress.processed / syncProgress.total) * 100
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
							ref={logRef}
							onScroll={(event) => {
								const el = event.currentTarget;
								followLog.current =
									el.scrollHeight - el.scrollTop - el.clientHeight < 32;
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
					<div>
						{translations.UPDATE_LOG_EMPTY || "No update logs generated yet."}
					</div>
				</div>
			)}
		</div>
	);
}
