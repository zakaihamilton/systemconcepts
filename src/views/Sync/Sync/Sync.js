import { SyncContext } from "@components/Sync";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import CachedIcon from "@icons/svg/Cached.svg";
import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import UpdateIcon from "@icons/svg/Update.svg";
import { clearBundleCache, useSyncFeature } from "@sync/sync";
import { SyncActiveStore } from "@sync/syncState";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Card from "@ui/Card";
import CardContent from "@ui/CardContent";
import FormControl from "@ui/FormControl";
import IconButton from "@ui/IconButton";
import InputLabel from "@ui/InputLabel";
import LinearProgress from "@ui/LinearProgress";
import MenuItem from "@ui/MenuItem";
import Select from "@ui/Select";
import Typography from "@ui/Typography";
import { logger as structuredLogger } from "@util/api/logger";
import { useOnline } from "@util/browser/online";
import { useStyles } from "@util/browser/styles";
import { useDateFormatter } from "@util/data/locale";
import { fileTitle } from "@util/data/path";
import { formatDuration } from "@util/data/string";
import { useGroups } from "@util/domain/groups";
import { useTranslations } from "@util/domain/translations";
import { useUpdateSessions } from "@util/domain/updateSessions";
import Dialog from "@widgets/Dialog";
import Tooltip from "@widgets/Tooltip";
import Cookies from "js-cookie";
import React, { useContext, useMemo } from "react";
import styles from "./Sync.module.css";

registerToolbar("Sync");

export default function Sync() {
	const online = useOnline();
	const translations = useTranslations();
	const context = useContext(SyncContext);
	const store =
		context && typeof context.getRawState === "function"
			? context
			: SyncActiveStore;

	const [groups] = useGroups([]);
	const { busy: sessionsBusy } = useUpdateSessions(groups);
	const {
		sync,
		stop,
		busy: syncBusy,
		lastSynced,
		percentage: syncPercentage,
		duration: syncDuration,
		currentBundle,
		logs,
		startTime,
	} = useSyncFeature();
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	const isAdmin = Cookies.get("role") === "admin";
	const syncEnabled = online && isSignedIn;
	const logRef = React.useRef(null);
	const [currentTime, setCurrentTime] = React.useState(() => Date.now());
	const [debugLevel, setDebugLevel] = React.useState("info");

	React.useEffect(() => {
		const currentLevel = store.getRawState().debugLevel || "info";
		setDebugLevel(currentLevel);

		const unsubscribe = store.subscribe(
			(s) => s.debugLevel,
			(level) => {
				setDebugLevel(level || "info");
			},
		);
		return unsubscribe;
	}, [store]);

	const handleDebugLevelChange = (event) => {
		const newLevel = event.target.value;
		setDebugLevel(newLevel);
		store.update((s) => {
			s.debugLevel = newLevel;
		});
	};

	React.useEffect(() => {
		let interval;
		if (syncBusy) {
			interval = setInterval(() => {
				setCurrentTime(Date.now());
			}, 1000);
		} else {
			setCurrentTime(Date.now());
		}
		return () => clearInterval(interval);
	}, [syncBusy]);

	const liveDuration =
		syncBusy && startTime ? currentTime - startTime : syncDuration || 0;

	React.useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [logs]);

	const dateFormatter = useDateFormatter({
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});

	const timeFormatter = useDateFormatter({
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	const isBusy = syncBusy || sessionsBusy;

	const [confirmFullSync, setConfirmFullSync] = React.useState(false);

	const animatedClassName = useStyles(styles, {
		animated: isBusy,
	});

	const fullSync = async () => {
		try {
			await clearBundleCache();
			setConfirmFullSync(false);
			await sync();
		} catch (err) {
			structuredLogger.error("Failed to full sync", err);
		}
	};

	const toolbarItems = [
		{
			id: "sync",
			name: translations.SYNC,
			icon: <UpdateIcon className={animatedClassName} />,
			onClick: () => sync && sync(),
			disabled: !syncEnabled || isBusy,
			location: "header",
		},
	];

	useToolbar({
		id: "Sync",
		items: toolbarItems,
		depends: [syncEnabled, isBusy, translations, online],
	});

	const fullSyncActions = (
		<>
			<Button variant="contained" color="warning" onClick={fullSync}>
				{translations.FULL_SYNC}
			</Button>
			<Button variant="contained" onClick={() => setConfirmFullSync(false)}>
				{translations.CANCEL}
			</Button>
		</>
	);

	const bundleName = useMemo(() => {
		if (!currentBundle) return null;
		const name = fileTitle(currentBundle);
		return name[0].toUpperCase() + name.slice(1);
	}, [currentBundle]);

	const [copied, setCopied] = React.useState(false);

	const copyToClipboard = () => {
		const text = logs
			?.map(
				(log) =>
					`[${timeFormatter.format(new Date(log.timestamp))}] ${log.message}`,
			)
			.join("\n");
		if (text) {
			navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<Box className={styles.root}>
			<Card className={styles.headerCard}>
				<CardContent>
					<Box className={styles.headerLayout}>
						<Box className={styles.headerRow}>
							<Box className={styles.statBoxWide}>
								<Typography
									variant="subtitle2"
									color="text.secondary"
									gutterBottom
								>
									{translations.LAST_SYNCED}
								</Typography>
								<Typography variant="h6" noWrap>
									{lastSynced
										? dateFormatter.format(new Date(lastSynced))
										: translations.NEVER}
								</Typography>
							</Box>

							<Box className={styles.statBoxNarrow}>
								<Typography
									variant="subtitle2"
									color="text.secondary"
									gutterBottom
								>
									{translations.DURATION}
								</Typography>
								<Typography variant="h6" noWrap>
									{syncBusy || syncDuration
										? formatDuration(liveDuration)
										: "--:--"}
								</Typography>
							</Box>

							<Box className={styles.statBoxMedium}>
								<Typography
									variant="subtitle2"
									color="text.secondary"
									gutterBottom
								>
									{translations.SYNC_STATUS}
								</Typography>
								<Box className={styles.statusRow}>
									<Typography variant="h6" noWrap>
										{syncBusy
											? translations.SYNCING
											: lastSynced
												? translations.COMPLETE
												: translations.IDLE}
									</Typography>
									{syncBusy && (
										<UpdateIcon
											className={`${animatedClassName} ${styles.syncIcon}`}
										/>
									)}
								</Box>
							</Box>

							<Box className={styles.actionsRow}>
								{syncBusy && (
									<Button
										variant="outlined"
										color="error"
										onClick={stop}
										className={styles.nowrapButton}
									>
										{translations.STOP || "Stop"}
									</Button>
								)}
								{isAdmin && (
									<FormControl size="small" className={styles.debugSelect}>
										<InputLabel id="debug-level-label">
											{translations.LOG_LEVEL || "Log Level"}
										</InputLabel>
										<Select
											labelId="debug-level-label"
											id="debug-level-select"
											value={debugLevel}
											label={translations.LOG_LEVEL || "Log Level"}
											onChange={handleDebugLevelChange}
										>
											<MenuItem value="info">Info</MenuItem>
											<MenuItem value="verbose">Verbose</MenuItem>
										</Select>
									</FormControl>
								)}
								<Button
									variant="outlined"
									color="warning"
									startIcon={<CachedIcon />}
									onClick={() => setConfirmFullSync(true)}
									disabled={isBusy}
									className={
										isBusy
											? styles.fullSyncButtonDisabled
											: styles.fullSyncButton
									}
								>
									{translations.FULL_SYNC}
								</Button>
							</Box>
						</Box>

						<Box className={styles.progressSection}>
							<Box className={styles.progressHeader}>
								<Typography
									variant="body2"
									color="text.secondary"
									noWrap
									className={styles.progressLabel}
								>
									{syncBusy
										? bundleName
											? `${translations.SYNCING} ${bundleName}...`
											: translations.SYNCING
										: translations.IDLE}
								</Typography>
								<Typography
									variant="body2"
									color="text.secondary"
									className={styles.progressPercent}
								>
									{syncPercentage}%
								</Typography>
							</Box>
							<LinearProgress
								variant="determinate"
								value={syncPercentage}
								className={styles.progressBar}
							/>
						</Box>
					</Box>
				</CardContent>
			</Card>

			<Box className={styles.terminalWrapper}>
				<Box className={styles.terminal} ref={logRef}>
					<Box className={styles.terminalContent}>
						{logs?.length === 0 && (
							<Typography className={styles.logEntry}>
								<span className={styles.logTimestamp}>
									[{timeFormatter.format(new Date())}]
								</span>{" "}
								Waiting for synchronization milestones...
							</Typography>
						)}
						{logs?.map((log) => (
							<Typography
								key={log.id}
								className={styles.logEntry}
								data-type={log.type}
							>
								<span className={styles.logTimestamp}>
									[{timeFormatter.format(new Date(log.timestamp))}]
								</span>{" "}
								{log.message}
							</Typography>
						))}
					</Box>
				</Box>
				<Box className={styles.copyButtonWrapper}>
					<Tooltip
						title={copied ? translations.LOG_COPIED : translations.COPY_LOG}
						arrow
						placement="left"
					>
						<IconButton onClick={copyToClipboard} className={styles.copyButton}>
							<ContentCopyIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>

			{confirmFullSync && (
				<Dialog
					title={translations.FULL_SYNC}
					onClose={() => setConfirmFullSync(false)}
					actions={fullSyncActions}
				>
					<Typography variant="body1">
						{translations.FULL_SYNC_MESSAGE}
					</Typography>
				</Dialog>
			)}
		</Box>
	);
}
