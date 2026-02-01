import { useMemo, useState } from "react";
import { useTranslations } from "@util/translations";
import { useSessions, SessionsStore } from "@util/sessions";
import { getComparator, stableSort } from "@util/sort";
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration, copyToClipboard } from "@util/string";
import Summary from "@widgets/Summary";
import Image from "@widgets/Image";
import styles from "./Session.module.scss";
import { addPath, replacePath } from "@util/pages";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useDeviceType } from "@util/styles";
import { useSwipe } from "@util/touch";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { getContrastColor } from "@util/color";

registerToolbar("Session");

export default function SessionPage({ group, year, date, name }) {
    const isMobile = useDeviceType() !== "desktop";
    const translations = useTranslations();
    const { order, orderBy } = SessionsStore.useState();
    const [sessions, loading] = useSessions([], { filterSessions: false, skipSync: true });
    const [filteredSessions] = useSessions([], { filterSessions: true, active: false, skipSync: true, showToolbar: false });
    const [copiedTag, setCopiedTag] = useState(null);
    const [showClipboard, setShowClipboard] = useState(false);

    const sortedFilteredSessions = useMemo(() => {
        if (!filteredSessions) return [];
        return stableSort(filteredSessions, getComparator(order, orderBy));
    }, [filteredSessions, order, orderBy]);

    const currentIndex = sortedFilteredSessions.findIndex(session =>
        session.group === group &&
        session.name === name &&
        session.date === date &&
        session.year === year);
    const prevSession = currentIndex > 0 && sortedFilteredSessions[currentIndex - 1];
    const nextSession = currentIndex !== -1 && currentIndex < sortedFilteredSessions.length - 1 && sortedFilteredSessions[currentIndex + 1];

    const gotoSession = session => {
        replacePath(`session?group=${session.group}&year=${session.year}&date=${session.date}&name=${encodeURIComponent(session.name)}`);
    }

    const toolbarItems = [
        !isMobile && {
            id: "prevSession",
            name: translations.PREVIOUS,
            icon: <ArrowBackIcon />,
            onClick: () => prevSession && gotoSession(prevSession),
            location: "header",
            disabled: !prevSession
        },
        !isMobile && {
            id: "nextSession",
            name: translations.NEXT,
            icon: <ArrowForwardIcon />,
            onClick: () => nextSession && gotoSession(nextSession),
            location: "header",
            disabled: !nextSession
        }
    ];

    useToolbar({ id: "Session", items: toolbarItems, depends: [prevSession, nextSession, translations, isMobile] });
    const dateFormatter = useDateFormatter({
        weekday: "long",
        year: "numeric",
        month: isMobile ? "short" : "long",
        day: "numeric"
    });

    const swipeHandlers = useSwipe({
        onSwipeLeft: () => nextSession && gotoSession(nextSession),
        onSwipeRight: () => prevSession && gotoSession(prevSession)
    });

    const session = sessions && sessions.find(session =>
        session.group === group &&
        session.name === name &&
        session.date === date &&
        session.year === year);

    if (loading && !session) {
        return <div className={styles.root}>{translations.LOADING}...</div>;
    }

    if (!session) {
        return <div className={styles.root}>{translations.NOT_FOUND}</div>;
    }

    const { duration, thumbnail } = session;

    const viewImage = () => {
        const path = session.image ? session.image.path : (typeof thumbnail === "string" && !thumbnail.startsWith("data:") ? thumbnail : null);
        if (path) {
            const extension = path.split(".").pop();
            addPath(extension === "png" ? "image" : "image?ext=" + extension);
        }
    };

    let dateWidget = "";
    try {
        dateWidget = date && dateFormatter.format(new Date(date));
    }
    catch (err) {
        console.error("err", err);
    }



    return <div className={styles.root} {...swipeHandlers}>
        <div className={styles.card} style={{ "--group-color": session.color }}>
            <div className={styles.header}>
                <div className={styles.title} onClick={() => {
                    const fullName = `${date} ${name}`;
                    const success = copyToClipboard(fullName);
                    if (success) {
                        setCopiedTag(fullName);
                        setShowClipboard(true);
                    }
                }}>{name}</div>
                <div className={styles.metadata}>
                    <Group name={group} color={session.color} />
                    <span className={styles.date}>{dateWidget}</span>
                    {duration > 1 && <span className={styles.duration}>{session.position && formatDuration(session.position * 1000, true) + " / "}{formatDuration(duration * 1000, true)}</span>}
                </div>
                {session.tags && session.tags.length > 0 && (
                    <div className={styles.tags}>
                        {session.tags.map(tag => (
                            <Chip key={tag} label={tag} onClick={() => {
                                const success = copyToClipboard(tag);
                                if (success) {
                                    setCopiedTag(tag);
                                    setShowClipboard(true);
                                }
                            }} className={styles.tag} style={{ "--tag-contrast": getContrastColor(session.color || "#3b82f6") }} />
                        ))}
                    </div>
                )}
            </div>
            <div className={styles.content}>
                {thumbnail && <div className={styles.media}>
                    <Image
                        path={thumbnail}
                        className={styles.thumbnail}
                        width="100%"
                        height="auto"
                        onClick={viewImage}
                        alt={name}
                    />
                </div>}
                <div className={styles.details}>
                    {session.type !== "image" && <div className={styles.summary}>
                        <Summary path={session.summary?.path} content={session.summaryText} key={session.summary?.path || session.name} />
                    </div>}
                </div>
            </div>
        </div>
        <Snackbar
            open={showClipboard}
            autoHideDuration={3000}
            onClose={() => setShowClipboard(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
            <Alert onClose={() => setShowClipboard(false)} severity="success" sx={{ width: '100%' }}>
                {(translations.COPIED_TO_CLIPBOARD || "Copied to clipboard") + ": " + (copiedTag || "")}
            </Alert>
        </Snackbar>
    </div>;
}
