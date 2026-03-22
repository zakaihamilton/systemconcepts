import { useState, useEffect } from "react";
import styles from "./Podcast.module.css";
import { useTranslations } from "@util/translations";
import { fetchJSON } from "@util/fetch";
import Cookies from "js-cookie";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";

export default function Podcast() {
    const translations = useTranslations();
    const [user, setUser] = useState(null);
    const userId = Cookies.get("id");
    const isSignedIn = userId && Cookies.get("hash");

    useEffect(() => {
        if (isSignedIn) {
            fetchJSON("/api/users", {
                headers: {
                    id: userId
                }
            })
                .then(data => {
                    setUser(data);
                })
                .catch(console.error);
        }
    }, [isSignedIn, userId]);

    if (!isSignedIn || !user || user.err || user.role === "visitor" || !user.rssToken) {
        return null; // Or show an access denied message
    }

    const podcastUrl = `${window.location.origin}/api/rss?id=${userId}&token=${user.rssToken}`;

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                <Typography variant="h4" className={styles.title}>{translations.PODCAST}</Typography>
                <Grid container spacing={2} className={styles.form}>
                    <Grid size={12}>
                        <Typography className={styles.podcastTitle}>{translations.PODCAST_FEED}</Typography>
                        <Typography className={styles.podcastDescription}>
                            {translations.PODCAST_FEED_DESCRIPTION}
                        </Typography>
                        <div className={styles.podcastUrlContainer}>
                            <div className={styles.podcastUrl}>
                                {podcastUrl}
                            </div>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    navigator.clipboard.writeText(podcastUrl);
                                }}
                            >
                                {translations.COPY_URL}
                            </Button>
                        </div>
                    </Grid>
                </Grid>
            </div>
        </div>
    );
}
