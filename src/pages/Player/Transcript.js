import { useRef, useEffect, useState } from "react";
import styles from "./Transcript.module.scss";
import { PlayerStore } from "../Player";
import Controls from "./Controls";
import { useFetch } from "@util/fetch";
import Progress from "@widgets/Progress";
import Download from "@widgets/Download";

export default function Transcript({ mode }) {
    const { subtitles, player } = PlayerStore.useState();
    const [transcript, setTranscript] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);
    const [data, , loading] = useFetch(subtitles);
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
            player.currentTime = time; // eslint-disable-line react-hooks/immutability
            player.play();
        }
    };

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

    const handleDownload = () => {
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement("a");
        link.href = url;
        const name = decodeURIComponent(subtitles).split("/").pop();
        link.setAttribute("download", name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return <div className={styles.root}>
        {loading && <div className={styles.loadingContainer}>
            <Progress fullscreen />
        </div>}
        <Download onClick={handleDownload} visible={!loading && !!data} />
        <div className={styles.transcript} ref={scrollRef}>
            {transcript.map((line, index) => {
                const isCurrent = index === currentLineIndex;
                return <div
                    key={index}
                    ref={el => lineRefs.current[index] = el}
                    className={`${styles.line} ${isCurrent ? styles.current : ""}`}
                    onClick={() => jumpTo(line.start)}
                >
                    <span className={styles.time}>
                        {formatTime(line.start)}
                    </span>
                    {line.text}
                </div>;
            })}
        </div>
    </div>;
}
