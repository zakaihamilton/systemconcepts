import { useRef, useEffect, useState } from "react";
import { UpdateSessionsStore } from "@util/updateSessions";
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

export default function ProgressDialog() {
    const translations = useTranslations();
    // We track 'busy' to know when to open, but we use 'open' to control visibility
    // so the user can close it manually, or keep it open after sync finishes.
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

    // Filter status for items that have started (have processed years or errors)
    // or we can just show all active content.
    // The status array accumulates, so we might want to show everything in it
    // but maybe clearer to show only what's happened in this session (handled by Store reset?)
    // Actually UpdateSessionsStore doesn't seem to reset status array between runs based on lines 67-82
    // It finds existing item or appends.
    // So let's just display the status list.

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
                        <div className={styles.newSessionsTitle}>{translations.NEW_SESSIONS || "New Sessions"}:</div>
                        <div className={styles.sessionsList}>
                            {item.newSessions.map((session, idx) => (
                                <div key={idx} className={styles.sessionItem}>
                                    <div className={styles.sessionName}>{session.name}</div>
                                    <div className={styles.sessionFiles}>
                                        {session.files.map((file, fileIdx) => (
                                            <div key={fileIdx} className={styles.fileName}>{file}</div>
                                        ))}
                                    </div>
                                </div>
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
