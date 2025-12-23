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
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import DescriptionIcon from "@mui/icons-material/Description";

export default function SessionPage({ group, year, date, name }) {
    const translations = useTranslations();
    const [sessions, loading] = useSessions([], { filterSessions: false });
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

    const { duration, thumbnail, video, audio, summary } = session;

    const playVideo = () => {
         addPath("player?suffix=.mp4");
    };

    const playAudio = () => {
        addPath("player?suffix=.m4a");
    };

    const viewImage = () => {
        addPath("image");
    };

    const viewTranscript = () => {
        addPath("transcript");
    };

    let dateWidget = "";
    try {
        dateWidget = date && dateFormatter.format(new Date(date));
    }
    catch (err) {
        console.error("err", err);
    }

    const hasVideo = !!video;
    const hasAudio = !!audio;
    const hasImage = !!thumbnail;
    const hasTranscript = !!session.subtitles;

    return <div className={styles.root}>
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.title}>{name}</div>
                <div className={styles.metadata}>
                    <Group name={group} color={session.color} />
                    <span>{dateWidget}</span>
                    {duration > 1 && <span>{formatDuration(duration * 1000, true)}</span>}
                </div>
            </div>
            <div className={styles.content}>
                <div className={styles.media}>
                    {thumbnail && <Image
                        path={thumbnail}
                        className={styles.thumbnail}
                        width="100%"
                        height="auto"
                        alt={name}
                        clickForImage={false}
                    />}
                    <div className={styles.actions}>
                        {hasVideo && <Button
                            variant="contained"
                            color="primary"
                            startIcon={<MovieIcon />}
                            onClick={playVideo}
                            fullWidth
                        >
                            {translations.VIDEO}
                        </Button>}
                        {hasAudio && <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AudioIcon />}
                            onClick={playAudio}
                            fullWidth={!hasVideo}
                        >
                            {translations.AUDIO}
                        </Button>}
                         {hasImage && !hasVideo && <Button
                            variant="outlined"
                            startIcon={<InsertPhotoIcon />}
                            onClick={viewImage}
                        >
                            {translations.IMAGE}
                        </Button>}
                         {hasTranscript && <Button
                            variant="outlined"
                            startIcon={<DescriptionIcon />}
                            onClick={viewTranscript}
                        >
                            {translations.TRANSCRIPT}
                        </Button>}
                    </div>
                </div>
                <div className={styles.details}>
                    {summary && <div className={styles.summary}>
                        <Summary path={summary.path.replace(/^\/aws/, "").replace(/^\//, "")} />
                    </div>}
                    {!summary && <div className={styles.summary}>{translations.NO_SUMMARY}</div>}
                </div>
            </div>
        </div>
    </div>;
}
