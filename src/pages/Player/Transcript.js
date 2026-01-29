import { useRef, useEffect, useState, useMemo } from "react";
import styles from "./Transcript.module.scss";
import { PlayerStore } from "../Player";

import { useFetch } from "@util/fetch";
import Progress from "@widgets/Progress";
import Download from "@widgets/Download";
import { useTranslations } from "@util/translations";
import { useSearch } from "@components/Search";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

registerToolbar("Transcript");

export default function Transcript({ show }) {
    const translations = useTranslations();
    const { subtitles, player } = PlayerStore.useState();
    const [transcript, setTranscript] = useState([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);
    const [data, , loading] = useFetch(subtitles);
    const scrollRef = useRef();
    const lineRefs = useRef({});
    const [matches, setMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    const searchTerm = useSearch("Transcript", null, show);

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
        if (!searchTerm || !transcript.length) {
            setMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        const lowerSearch = searchTerm.toLowerCase();
        const newMatches = [];

        transcript.forEach((line, lineIndex) => {
            const text = line.text.toLowerCase();
            let startIndex = 0;
            let index;

            while ((index = text.indexOf(lowerSearch, startIndex)) > -1) {
                newMatches.push({
                    lineIndex,
                    start: index,
                    end: index + searchTerm.length
                });
                startIndex = index + searchTerm.length;
            }
        });

        setMatches(newMatches);
        if (newMatches.length > 0) {
            setCurrentMatchIndex(0);
        } else {
            setCurrentMatchIndex(-1);
        }
    }, [searchTerm, transcript]);

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
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex] && scrollRef.current && matches.length === 0) {
            const element = lineRefs.current[currentLineIndex];
            element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [currentLineIndex, matches.length]);

    useEffect(() => {
        if (currentMatchIndex !== -1 && matches[currentMatchIndex]) {
            const { lineIndex } = matches[currentMatchIndex];
            const element = lineRefs.current[lineIndex];
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [currentMatchIndex, matches]);

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

    const nextMatch = () => {
        setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    };

    const prevMatch = () => {
        setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    };

    const toolbarItems = [
        matches.length > 0 && {
            id: "prevMatch",
            name: translations.PREVIOUS_MATCH,
            icon: <ArrowUpwardIcon />,
            sortKey: -1,
            onClick: prevMatch,
            location: "header"
        },
        matches.length > 0 && {
            id: "nextMatch",
            name: translations.NEXT_MATCH,
            icon: <ArrowDownwardIcon />,
            sortKey: -1,
            onClick: nextMatch,
            location: "header"
        }
    ].filter(Boolean);

    useToolbar({ id: "Transcript", items: toolbarItems, visible: show, depends: [matches.length, translations, show] });

    const matchesByLine = useMemo(() => {
        const byLine = {};
        matches.forEach((match, index) => {
            if (!byLine[match.lineIndex]) {
                byLine[match.lineIndex] = [];
            }
            byLine[match.lineIndex].push({ ...match, globalIndex: index });
        });
        return byLine;
    }, [matches]);

    const highlightText = (text, lineIndex) => {
        if (!searchTerm || !matches.length) return text;

        const lineMatches = matchesByLine[lineIndex];

        if (!lineMatches || !lineMatches.length) return text;

        const parts = [];
        let lastIndex = 0;

        lineMatches.forEach((match, i) => {
            if (match.start > lastIndex) {
                parts.push(text.substring(lastIndex, match.start));
            }
            const isCurrent = match.globalIndex === currentMatchIndex;
            parts.push(
                <span key={i} className={`${styles.highlight} ${isCurrent ? styles.currentMatch : ""}`}>
                    {text.substring(match.start, match.end)}
                </span>
            );
            lastIndex = match.end;
        });

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts;
    };

    return <div className={styles.root}>
        {loading && <div className={styles.loadingContainer}>
            <Progress fullscreen />
        </div>}
        <Download onClick={handleDownload} visible={!loading && !!data} title={translations.DOWNLOAD_TRANSCRIPT} />
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
                    {highlightText(line.text, index)}
                </div>;
            })}
        </div>
    </div>;
}
