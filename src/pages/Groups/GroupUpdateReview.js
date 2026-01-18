import { useTranslations } from "@util/translations";
import styles from "./GroupUpdateReview.module.scss";
import Dialog from "@components/Widgets/Dialog";
import Button from "@mui/material/Button";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import Chip from "@mui/material/Chip";
import clsx from "clsx";
import SessionIcon from "@mui/icons-material/Assignment";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useState } from "react";
import UpdateIcon from "@mui/icons-material/Update";

function NewSessionItem({ session }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={clsx(styles.sessionItem, expanded && styles.expanded)}>
            <div className={styles.sessionName} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                <SessionIcon className={styles.sessionIcon} />
                <span style={{ flex: 1 }}>{session.name || session.id}</span>
                {session.files && session.files.length > 0 && (
                    expanded ? <ExpandLessIcon className={styles.expandIcon} /> : <ExpandMoreIcon className={styles.expandIcon} />
                )}
            </div>
            {expanded && session.files && (
                <div className={styles.sessionFiles}>
                    {session.files.map((file, fileIdx) => (
                        <div key={fileIdx} className={styles.fileName}>
                            <DescriptionIcon className={styles.fileIcon} />
                            {typeof file === 'string' ? file : file.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ChangesList({ items, title, icon: Icon }) {
    const [expanded, setExpanded] = useState(true);

    if (!items || items.length === 0) return null;

    return (
        <div className={styles.changesSection}>
            <div className={styles.changesTitle} onClick={() => setExpanded(!expanded)}>
                <Icon className={styles.titleIcon} />
                <span style={{ flex: 1 }}>{title} ({items.length})</span>
                {expanded ? <ExpandLessIcon className={styles.expandIcon} /> : <ExpandMoreIcon className={styles.expandIcon} />}
            </div>
            {expanded && (
                <div className={styles.sessionsList}>
                    {items.map((item, idx) => (
                        <NewSessionItem key={idx} session={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function GroupReviewItem({ group, translations }) {
    const [expanded, setExpanded] = useState(false);
    const { name, newSessions, updatedSessions, removedSessions, totalSessions } = group;

    const hasChanges = (newSessions?.length > 0) || (updatedSessions?.length > 0) || (removedSessions?.length > 0);

    return (
        <div className={styles.item}>
            <div className={styles.header} onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
                <div className={styles.name}>{name}</div>
                <div style={{ flex: 1 }} />
                <div className={styles.headerSummary}>
                    {newSessions?.length > 0 && <Chip label={`+${newSessions.length}`} color="success" size="small" className={styles.countChip} />}
                    {updatedSessions?.length > 0 && <Chip label={`~${updatedSessions.length}`} color="primary" size="small" className={styles.countChip} />}
                    {removedSessions?.length > 0 && <Chip label={`-${removedSessions.length}`} color="error" size="small" className={styles.countChip} />}
                    {!hasChanges && <span className={styles.noChanges}>{translations.NO_UPDATES}</span>}
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </div>
            </div>
            {expanded && (
                <div className={styles.details}>
                    <div className={styles.totalStats}>
                        {translations.TOTAL_SESSIONS}: {totalSessions}
                    </div>
                    <ChangesList items={newSessions} title={translations.NEW_SESSIONS} icon={SessionIcon} />
                    <ChangesList items={updatedSessions} title={translations.UPDATED_SESSIONS} icon={UpdateIcon} />
                </div>
            )}
        </div>
    );
}

export default function GroupUpdateReview({ open, onClose, onApprove, groups }) {
    const translations = useTranslations();
    const totalNew = groups.reduce((acc, g) => acc + (g.newSessions?.length || 0), 0);
    const totalUpdated = groups.reduce((acc, g) => acc + (g.updatedSessions?.length || 0), 0);
    const totalRemoved = groups.reduce((acc, g) => acc + (g.removedSessions?.length || 0), 0);

    const hasChanges = totalNew > 0 || totalUpdated > 0 || totalRemoved > 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={translations.REVIEW_UPDATE}
            className={styles.dialog}
            actions={
                <>
                    <Button onClick={onClose} color="secondary" startIcon={<CloseIcon />}>
                        {translations.CANCEL}
                    </Button>
                    <Button
                        onClick={onApprove}
                        color="primary"
                        variant="contained"
                        startIcon={<CheckIcon />}
                        disabled={!hasChanges}
                    >
                        {translations.APPROVE_UPDATE}
                    </Button>
                </>
            }
        >
            <div className={styles.content}>
                <div className={styles.summary}>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>{translations.NEW}:</span>
                        <span className={styles.summaryValue}>{totalNew}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>{translations.UPDATED}:</span>
                        <span className={styles.summaryValue}>{totalUpdated}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>{translations.REMOVED}:</span>
                        <span className={styles.summaryValue}>{totalRemoved}</span>
                    </div>
                </div>

                <div className={styles.groupsList}>
                    {groups.map((group) => (
                        <GroupReviewItem key={group.name} group={group} translations={translations} />
                    ))}
                </div>
            </div>
        </Dialog>
    );
}
