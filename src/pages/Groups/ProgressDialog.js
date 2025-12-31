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

export default function ProgressDialog() {
    const translations = useTranslations();
    const { busy, status, start } = UpdateSessionsStore.useState();
    const [open, setOpen] = useState(false);
    const wasBusyRef = useRef(false);
    const [currentTime, setCurrentTime] = useState(new Date().getTime());

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
            setOpen(true);
        }
        wasBusyRef.current = busy;
    }, [busy]);

    const handleClose = () => {
        setOpen(false);
    };

    const renderItem = (item) => {
        const hasErrors = item.errors && item.errors.length > 0;
        const progress = item.count > 0 ? (item.progress / item.count) * 100 : 0;
        const isDone = item.count > 0 && item.progress === item.count;
        const hasNewSessions = item.newSessions && item.newSessions.length > 0;

        return (
            <div key={item.name} className={styles.item}>
                <div className={styles.header}>
                    <div className={styles.name}>{item.name}</div>
                    <div className={styles.statusIcon}>
                        {hasErrors ? <ErrorIcon color="error" /> : (isDone ? <CheckIcon color="success" /> : null)}
                    </div>
                </div>
                <div className={styles.progressContainer}>
                    <LinearProgress variant="determinate" value={progress} className={styles.progressBar} color={hasErrors ? "error" : "primary"} />
                    <div className={styles.progressText}>
                        {item.tagCount > 0 && <Chip label={`${item.tagCount}`} color="primary" size="small" className={styles.countChip} />}
                        {item.addedCount > 0 && <Chip label={`+${item.addedCount}`} color="success" size="small" className={styles.countChip} />}
                        {item.removedCount > 0 && <Chip label={`-${item.removedCount}`} color="error" size="small" className={styles.countChip} />}
                        <div style={{ flex: 1 }} />
                        {item.year && `${item.year} - `}{item.progress} / {item.count} {translations.YEARS}
                    </div>
                </div>
                {hasNewSessions && (
                    <div className={styles.newSessions}>
                        <div className={styles.newSessionsTitle}>
                            <SessionIcon className={styles.titleIcon} />
                            {translations.NEW_SESSIONS || "New Sessions"}
                        </div>
                        <div className={styles.sessionsList}>
                            {item.newSessions.map((session, idx) => (
                                <NewSessionItem key={idx} session={session} />
                            ))}
                        </div>
                    </div>
                )}
                {hasErrors && (
                    <div className={styles.errors}>
                        {item.errors.map((err, idx) => (
                            <div key={idx} className={styles.error}>{err.toString()}</div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!open) {
        return null;
    }

    const duration = start && currentTime - start;
    const formattedDuration = formatDuration(duration);

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
                {status.map(renderItem)}
                {status.length === 0 && <div className={styles.empty}>{translations.NO_UPDATES}</div>}
            </div>
        </Dialog>
    );
}
