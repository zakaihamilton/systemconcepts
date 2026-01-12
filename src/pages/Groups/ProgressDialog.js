import { useRef, useEffect, useState } from "react";
import { UpdateSessionsStore } from "@sync/syncState";
import { useTranslations } from "@util/translations";
import styles from "./ProgressDialog.module.scss";
import { formatDuration } from "@util/string";
import "@fontsource/dseg7/classic.css";
import Dialog from "@components/Widgets/Dialog";
import LinearProgress from "@mui/material/LinearProgress";
import CheckIcon from "@mui/icons-material/Check";
import ErrorIcon from "@mui/icons-material/Error";
import Chip from "@mui/material/Chip";
import clsx from "clsx";
import SessionIcon from "@mui/icons-material/Assignment";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

function NewSessionItem({ session }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={clsx(styles.sessionItem, expanded && styles.expanded)}>
            <div className={styles.sessionName} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                <SessionIcon className={styles.sessionIcon} />
                <span style={{ flex: 1 }}>{session.name}</span>
                {expanded ? <ExpandLessIcon className={styles.expandIcon} /> : <ExpandMoreIcon className={styles.expandIcon} />}
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
            <div className={styles.newSessionsTitle} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                <SessionIcon className={styles.titleIcon} />
                <span style={{ flex: 1 }}>{translations.NEW_SESSIONS}</span>
                {expanded ? <ExpandLessIcon className={styles.expandIcon} /> : <ExpandMoreIcon className={styles.expandIcon} />}
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
    const { busy, status, start, showUpdateDialog } = UpdateSessionsStore.useState();
    const wasBusyRef = useRef(false);
    const [currentTime, setCurrentTime] = useState(new Date().getTime());
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [isListExpanded, setListExpanded] = useState(false);

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
            UpdateSessionsStore.update(s => {
                s.showUpdateDialog = true;
            });
            setExpandedItems(new Set());
        }
        wasBusyRef.current = busy;
    }, [busy]);

    const handleClose = () => {
        UpdateSessionsStore.update(s => {
            s.showUpdateDialog = false;
        });
    };

    const renderItem = (item) => {
        return <ProgressItem key={item.name} item={item} translations={translations} />;
    };

    if (!showUpdateDialog) {
        return null;
    }

    // Filter items based on logic used in render
    const duration = start && currentTime - start;
    const formattedDuration = formatDuration(duration);

    const visibleItems = status.filter(item => item.count > 0 || (item.errors && item.errors.length > 0));
    const totalAdded = status.reduce((acc, item) => acc + (item.addedCount || 0), 0);

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

    return (
        <Dialog
            onClose={handleClose}
            title={translations.UPDATE_SESSIONS}
            className={styles.dialog}
        >

            {!!duration && <div className={clsx(styles.timer, busy ? styles.busy : styles.idle)}>
                <div className={styles.timerText}>{formattedDuration}</div>
                <div className={styles.timerGhost}>{formattedDuration.replace(/[0-9]/g, "8")}</div>
            </div>}
            <div className={styles.content}>
                <div className={styles.totalAdded} onClick={toggleList} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>{translations.TOTAL_SESSIONS_ADDED}: {totalAdded}</span>
                    {isListExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </div>
                {isListExpanded && visibleItems.map(item => (
                    <ProgressItem
                        key={item.name}
                        item={item}
                        translations={translations}
                        expanded={expandedItems.has(item.name)}
                        onToggle={() => toggleItem(item.name)}
                    />
                ))}
                {isListExpanded && visibleItems.length === 0 && <div className={styles.empty}>{translations.NO_UPDATES}</div>}
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
        <div key={item.name} className={styles.item}>
            <div className={styles.header} onClick={onToggle} style={{ cursor: 'pointer' }}>
                <div className={styles.statusIcon}>
                    {hasErrors ? <ErrorIcon color="error" /> : (isDone ? <CheckIcon color="success" /> : null)}
                </div>
                <div className={styles.name}>{item.name}</div>
                <div style={{ flex: 1 }} />
                <div className={styles.headerSummary}>
                    {item.addedCount > 0 && <Chip label={`+${item.addedCount}`} color="success" size="small" className={styles.countChip} />}
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </div>
            </div>
            {expanded && (
                <>
                    <div className={styles.progressContainer}>
                        <LinearProgress variant="determinate" value={progress} className={styles.progressBar} color={hasErrors ? "error" : "primary"} />
                        <div className={styles.progressText}>
                            {item.removedCount > 0 && <Chip label={`-${item.removedCount}`} color="error" size="small" className={styles.countChip} />}
                            <div style={{ flex: 1 }} />
                            {item.year && `${item.year} - `}{item.progress} / {item.count} {translations.YEARS}
                        </div>
                    </div>
                    {hasNewSessions && <NewSessionsList sessions={item.newSessions} />}
                    {hasErrors && (
                        <div className={styles.errors}>
                            {item.errors.map((err, idx) => (
                                <div key={idx} className={styles.error}>{err.toString()}</div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
