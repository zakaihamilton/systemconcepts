import { useRef, useEffect, useState, useCallback } from "react";
import styles from "./Transcript.module.scss";
import { PlayerStore } from "./Player";
import Controls from "./Player/Controls";
import { useFetch } from "@util/fetch";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

registerToolbar("Transcript");

export default function Transcript() {
    const { subtitles, player } = PlayerStore.useState();
    const [transcript, setTranscript] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);
    const [data] = useFetch(subtitles);
    const scrollRef = useRef();
    const lineRefs = useRef({});

    useEffect(() => {
        if (!data) {
            setTranscript([]);
            return;
        }

        const lines = data.split(/\r?\n\r?\n/);
        const parsed = lines.map((block) => {
            const parts = block.split(/\n/);
            if (parts.length < 2) return null;
            // Handle optional index line (subtitle number)
            let timeString = parts[0];
            let textStartIndex = 1;
            if (!timeString.includes("-->")) {
                timeString = parts[1];
                textStartIndex = 2;
            }
            if (!timeString || !timeString.includes("-->")) return null;

            const [start, end] = timeString.split(" --> ");
            const text = parts.slice(textStartIndex).join("\n");

            const parseTime = (t) => {
                if (!t) return 0;
                const [hms, ms] = t.split(".");
                const [h, m, s] = hms.split(":").map(Number);
                return h * 3600 + m * 60 + s + (parseInt(ms) || 0) / 1000;
            };

            return {
                start: parseTime(start),
                end: parseTime(end),
                text
            };
        }).filter(Boolean);

        setTranscript(parsed);
    }, [data]);

    useEffect(() => {
        if (!player) return;

        const updateTime = () => {
            const time = player.currentTime;
            const index = transcript.findIndex(line => time >= line.start && time < line.end);
            setCurrentLineIndex(index);
        };

        player.addEventListener("timeupdate", updateTime);
        return () => {
            player.removeEventListener("timeupdate", updateTime);
        };
    }, [player, transcript]);

    useEffect(() => {
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex] && scrollRef.current) {
            const element = lineRefs.current[currentLineIndex];
            element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [currentLineIndex]);

    const jumpTo = (time) => {
        if (player) {
            player.currentTime = time;
            player.play();
        }
    };

    useToolbar({ id: "Transcript", items: [], visible: true });

    const formatTime = (seconds) => {
        const date = new Date(seconds * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds();
        if (hh > 0) {
            return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
        }
        return `${mm}:${ss.toString().padStart(2, '0')}`;
    };

    return <div className={styles.root}>
        <div className={styles.transcript} ref={scrollRef}>
            {transcript.map((line, index) => {
                const isCurrent = index === currentLineIndex;
                return <div
                    key={index}
                    ref={el => lineRefs.current[index] = el}
                    className={`${styles.line} ${isCurrent ? styles.current : ""}`}
                    onClick={() => jumpTo(line.start)}
                >
                    <div className={styles.time}>
                        {formatTime(line.start)}
                    </div>
                    <div className={styles.text}>{line.text}</div>
                    <div className={styles.playIcon}>
                        <PlayArrowIcon fontSize="small" />
                    </div>
                </div>;
            })}
        </div>
        <div className={styles.controls}>
            {player && <Controls playerRef={player} show={true} path={subtitles} />}
        </div>
    </div>;
}

