import React, { useMemo } from "react";
import { useTranslations } from "@util/translations";
import { useSessions, SessionsStore } from "@util/sessions";
import { getComparator, stableSort } from "@util/sort";
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration } from "@util/string";
import Summary from "@widgets/Summary";
import Image from "@widgets/Image";
import styles from "./Session.module.scss";
import { addPath, replacePath } from "@util/pages";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useDeviceType } from "@util/styles";

registerToolbar("Session");

export default function SessionPage({ group, year, date, name }) {
    const isMobile = useDeviceType() !== "desktop";
    const translations = useTranslations();
    const { order, orderBy } = SessionsStore.useState();
    const [sessions, loading] = useSessions([], { filterSessions: false, skipSync: true });
    const [filteredSessions] = useSessions([], { filterSessions: true, active: false, skipSync: true, showToolbar: false });

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
        {
            id: "prevSession",
            name: translations.PREVIOUS,
            icon: <ArrowBackIcon />,
            onClick: () => prevSession && gotoSession(prevSession),
            menu: false,
            location: "header",
            disabled: !prevSession
        },
        {
            id: "nextSession",
            name: translations.NEXT,
            icon: <ArrowForwardIcon />,
            onClick: () => nextSession && gotoSession(nextSession),
            menu: false,
            location: "header",
            disabled: !nextSession
        }
    ];

    useToolbar({ id: "Session", items: toolbarItems, depends: [prevSession, nextSession, translations] });
    const dateFormatter = useDateFormatter({
        weekday: "long",
        year: "numeric",
        month: isMobile ? "short" : "long",
        day: "numeric"
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

    const { duration, thumbnail, video } = session;

    const viewImage = () => {
        addPath("image");
    };

    let dateWidget = "";
    try {
        dateWidget = date && dateFormatter.format(new Date(date));
    }
    catch (err) {
        console.error("err", err);
    }

    return <div className={styles.root}>
        <div className={styles.card} style={{ "--group-color": session.color }}>
            <div className={styles.header}>
                <div className={styles.title}>{name}</div>
                <div className={styles.metadata}>
                    <Group name={group} color={session.color} />
                    <span className={styles.date}>{dateWidget}</span>
                    {duration > 1 && <span className={styles.duration}>{formatDuration(duration * 1000, true)}</span>}
                </div>
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
                        clickForImage={false}
                    />
                </div>}
                <div className={styles.details}>
                    <div className={styles.summary}>
                        <Summary path={session.summary?.path} key={session.summary?.path} />
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
