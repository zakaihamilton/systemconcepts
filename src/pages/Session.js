import React from "react";
import { useTranslations } from "@util/translations";
import { useSessions } from "@util/sessions";
import { useDateFormatter } from "@util/locale";
import Group from "@widgets/Group";
import { formatDuration } from "@util/string";
import Summary from "@widgets/Summary";
import Image from "@widgets/Image";
import styles from "./Session.module.scss";
import Button from "@mui/material/Button";
import { addPath } from "@util/pages";
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [sessions, loading] = useSessions([], { filterSessions: false, skipSync: true });
    const dateFormatter = useDateFormatter({
        weekday: "long",
        year: "numeric",
        month: "long",
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

    const hasVideo = !!video;
    const hasImage = !!thumbnail;

    return <div className={styles.root}>
        <div className={styles.card}>
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
                        alt={name}
                        clickForImage={false}
                    />
                    <div className={styles.actions}>
                        {hasImage && !hasVideo && <Button
                            variant="outlined"
                            startIcon={<InsertPhotoIcon />}
                            onClick={viewImage}
                        >
                            {translations.IMAGE}
                        </Button>}
                    </div>
                </div>}
                <div className={styles.details}>
                    {session.summary && <div className={styles.summary}>
                        <Summary path={session.summary.path.replace(/^\/aws/, "").replace(/^\//, "")} />
                    </div>}
                    {!session.summary && <div className={styles.summary}>{translations.NO_SUMMARY}</div>}
                </div>
            </div>
        </div>
    </div>;
}
