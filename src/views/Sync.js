import React, { useMemo } from "react";
import { useUpdateSessions } from "@util/updateSessions";
import { useTranslations } from "@util/translations";
import { useGroups } from "@util/groups";
import { useSyncFeature } from "@sync/sync";
import styles from "./Sync.module.scss";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { formatDuration } from "@util/string";
import UpdateIcon from "@mui/icons-material/Update";
import { useStyles } from "@util/styles";
import { useDateFormatter } from "@util/locale";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import { useContext } from "react";
import { SyncContext } from "@components/Sync";
import CachedIcon from "@mui/icons-material/Cached";
import { clearBundleCache } from "@sync/sync";
import { SyncActiveStore } from "@sync/syncState";
import Dialog from "@widgets/Dialog";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { fileTitle } from "@util/path";

registerToolbar("Sync");

export default function Sync() {
    const online = useOnline();
    const translations = useTranslations();
    const context = useContext(SyncContext);
    const store = (context && typeof context.getRawState === 'function') ? context : SyncActiveStore;

    const [groups] = useGroups([]);
    const { busy: sessionsBusy } = useUpdateSessions(groups);
    const { sync, stop, busy: syncBusy, lastSynced, percentage: syncPercentage, duration: syncDuration, currentBundle, logs, startTime } = useSyncFeature();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isAdmin = Cookies.get("role") === "admin";
    const syncEnabled = online && isSignedIn;
    const logRef = React.useRef(null);
    const [currentTime, setCurrentTime] = React.useState(() => Date.now());
    const [debugLevel, setDebugLevel] = React.useState("info");

    React.useEffect(() => {
        const currentLevel = store.getRawState().debugLevel || "info";
        setDebugLevel(currentLevel);

        const unsubscribe = store.subscribe(s => s.debugLevel, level => {
            setDebugLevel(level || "info");
        });
        return unsubscribe;
    }, [store]);

    const handleDebugLevelChange = (event) => {
        const newLevel = event.target.value;
        setDebugLevel(newLevel);
        store.update(s => {
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

    const liveDuration = syncBusy && startTime ? (currentTime - startTime) : (syncDuration || 0);

    React.useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    const dateFormatter = useDateFormatter({
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });

    const timeFormatter = useDateFormatter({
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const isBusy = syncBusy || sessionsBusy;

    const [confirmFullSync, setConfirmFullSync] = React.useState(false);

    const animatedClassName = useStyles(styles, {
        animated: isBusy
    });

    const fullSync = async () => {
        try {
            await clearBundleCache();
            setConfirmFullSync(false);
            await sync();
        } catch (err) {
            console.error("Failed to full sync", err);
        }
    };

    const toolbarItems = [
        {
            id: "sync",
            name: translations.SYNC,
            icon: <UpdateIcon className={animatedClassName} />,
            onClick: () => sync && sync(),
            disabled: !syncEnabled || isBusy,
            location: "header"
        }
    ];

    useToolbar({ id: "Sync", items: toolbarItems, depends: [syncEnabled, isBusy, translations, online] });

    const fullSyncActions = (<>
        <Button variant="contained" color="warning" onClick={fullSync}>
            {translations.FULL_SYNC}
        </Button>
        <Button variant="contained" onClick={() => setConfirmFullSync(false)}>
            {translations.CANCEL}
        </Button>
    </>);

    const bundleName = useMemo(() => {
        if (!currentBundle) return null;
        const name = fileTitle(currentBundle);
        return name[0].toUpperCase() + name.slice(1);
    }, [currentBundle]);

    const [copied, setCopied] = React.useState(false);

    const copyToClipboard = () => {
        const text = logs?.map(log => `[${timeFormatter.format(new Date(log.timestamp))}] ${log.message}`).join('\n');
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <Box sx={{ minWidth: '150px' }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    {translations.LAST_SYNCED}
                                </Typography>
                                <Typography variant="h6" noWrap>
                                    {lastSynced ? dateFormatter.format(new Date(lastSynced)) : translations.NEVER}
                                </Typography>
                            </Box>

                            <Box sx={{ minWidth: '80px' }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    {translations.DURATION}
                                </Typography>
                                <Typography variant="h6" noWrap>
                                    {(syncBusy || syncDuration) ? formatDuration(liveDuration) : "--:--"}
                                </Typography>
                            </Box>

                            <Box sx={{ minWidth: '120px' }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    {translations.SYNC_STATUS}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="h6" noWrap>
                                        {syncBusy ? translations.SYNCING : (lastSynced ? translations.COMPLETE : translations.IDLE)}
                                    </Typography>
                                    {syncBusy && <UpdateIcon className={animatedClassName} sx={{ fontSize: 20 }} />}
                                </Box>
                            </Box>

                            <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                                {syncBusy && (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={stop}
                                        sx={{ whiteSpace: 'nowrap' }}
                                    >
                                        {translations.STOP || "Stop"}
                                    </Button>
                                )}
                                {isAdmin && <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel id="debug-level-label">{translations.LOG_LEVEL || "Log Level"}</InputLabel>
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
                                </FormControl>}
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    startIcon={<CachedIcon />}
                                    onClick={() => setConfirmFullSync(true)}
                                    disabled={isBusy}
                                    sx={{
                                        opacity: isBusy ? 0.5 : 1,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {translations.FULL_SYNC}
                                </Button>
                            </Box>
                        </Box>

                        <Box sx={{ width: '100%', mt: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
                                <Typography variant="body2" color="text.secondary" noWrap sx={{ textOverflow: 'ellipsis', overflow: 'hidden', flex: 1 }}>
                                    {syncBusy ? (bundleName ? `${translations.SYNCING} ${bundleName}...` : translations.SYNCING) : translations.IDLE}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ minWidth: '3.5em', textAlign: 'right', fontWeight: 'bold' }}>
                                    {syncPercentage}%
                                </Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={syncPercentage} sx={{ height: 8, borderRadius: 4 }} />
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Box sx={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Box className={styles.terminal} ref={logRef}>
                    <Box className={styles.terminalContent}>
                        {logs?.length === 0 && (
                            <Typography className={styles.logEntry}>
                                <span className={styles.logTimestamp}>[{timeFormatter.format(new Date())}]</span> Waiting for synchronization milestones...
                            </Typography>
                        )}
                        {logs?.map(log => (
                            <Typography key={log.id} className={styles.logEntry} data-type={log.type}>
                                <span className={styles.logTimestamp}>[{timeFormatter.format(new Date(log.timestamp))}]</span> {log.message}
                            </Typography>
                        ))}
                    </Box>
                </Box>
                <Box sx={{ position: 'absolute', top: 8, right: 16 }}>
                    <Tooltip title={copied ? translations.LOG_COPIED : translations.COPY_LOG} arrow placement="left">
                        <IconButton
                            onClick={copyToClipboard}
                            sx={{
                                color: 'rgba(255, 255, 255, 0.5)',
                                '&:hover': {
                                    color: '#fff',
                                    background: 'rgba(255, 255, 255, 0.1)'
                                }
                            }}
                        >
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {
                confirmFullSync && (
                    <Dialog title={translations.FULL_SYNC} onClose={() => setConfirmFullSync(false)} actions={fullSyncActions}>
                        <Typography variant="body1">
                            {translations.FULL_SYNC_MESSAGE}
                        </Typography>
                    </Dialog>
                )
            }
        </Box >
    );
}
