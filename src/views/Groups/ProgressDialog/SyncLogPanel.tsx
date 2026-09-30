import CheckIcon from "@icons/svg/Check.svg";
import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import InfoIcon from "@icons/svg/Info.svg";
import UploadIcon from "@icons/svg/Upload.svg";
import { IconButton } from "@ui";
import Chip from "@ui/Chip";
import LinearProgress from "@ui/LinearProgress";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import styles from "./ProgressDialog.module.css";

export default function SyncLogPanel({
	syncing,
	syncProgress,
	syncLogs,
	syncLogCopied,
	onCopy,
}: {
	syncing: boolean;
	syncProgress?: { processed: number; total: number };
	syncLogs: { message: string; type: string }[];
	syncLogCopied: boolean;
	onCopy: () => void;
}) {
	const translations = useTranslations();
	return (
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
								onClick={onCopy}
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
	);
}
