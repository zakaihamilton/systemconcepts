import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AudioControls.module.scss";
import { useTranslations } from "@/util/translations";
import PlayerButton from "../Button";
import FastRewindIcon from '@material-ui/icons/FastRewind';
import FastForwardIcon from '@material-ui/icons/FastForward';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ReplayIcon from '@material-ui/icons/Replay';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import { formatDuration } from "@/util/string";
import { MainStore } from "@/components/Main";
import MuiAlert from '@material-ui/lab/Alert';

const skipPoints = 10;

export default function AudioControls({ playerRef, metadata, setMetadata, path = "", group = "", year = "", name = "" }) {
    const progressRef = useRef(null);
    const { direction } = MainStore.useState();
    const translations = useTranslations();
    const dragging = useRef(false);
    const [, setCounter] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState(null);
    useEffect(() => {
        const update = name => {
            if (name === "error") {
                setError("PLAYING_ERROR");
            }
            else if (name === "loadstart") {
                setError(null);
            }
            else if (name === "loadedmetadata" && metadata && metadata.position) {
                playerRef.currentTime = metadata.position;
                setCurrentTime(playerRef.currentTime);
            }
            if (name === "timeupdate" && !dragging.current) {
                setCurrentTime(playerRef.currentTime);
            }
            else {
                setCounter(counter => counter + 1);
            }
        };
        const events = ["loadedmetadata", "pause", "error", "loadstart", "play", "playing", "volumechange", "timeupdate"];
        events.map(name => playerRef.addEventListener(name, () => update(name)));
        return () => {
            events.map(name => playerRef.removeEventListener(name, update));
        };
    }, []);
    useEffect(() => {
        playerRef.load();
    }, [path]);
    const seekPosition = useCallback(position => {
        if (isNaN(position)) {
            return;
        }
        playerRef.currentTime = position;
        setCurrentTime(position);
    }, []);
    const rewind = () => {
        let position = currentTime;
        if (position > skipPoints) {
            position -= skipPoints;
        }
        else {
            position = 0;
        }
        seekPosition(position);
    };
    const fastforward = () => {
        let position = currentTime;
        if (position > playerRef.duration - skipPoints) {
            position = playerRef.duration;
        }
        else {
            position += skipPoints;
        }
        seekPosition(position);
    };
    const left = currentTime / playerRef.duration * 100;
    const audioPos = isNaN(currentTime) ? 0 : currentTime;
    let progressText = formatDuration(audioPos * 1000);
    if (!isNaN(playerRef.duration)) {
        progressText += " / " + formatDuration(playerRef.duration * 1000);
        progressText += " ( " + translations.TIME_LEFT + " " + formatDuration((playerRef.duration - audioPos) * 1000) + " )";
    }
    const progressPosition = `calc(${left}%)`;
    const handlePosEvent = useCallback(e => {
        const { clientX } = e;
        if (!dragging.current) {
            return;
        }
        const width = progressRef.current.clientWidth;
        let coord = clientX - progressRef.current.getBoundingClientRect().left;
        const ratio = playerRef.duration / width;
        let position = coord * ratio;
        if (position < 0) {
            position = 0;
        }
        if (position >= playerRef.duration) {
            position = playerRef.duration;
        }
        seekPosition(position);
    }, []);
    useEffect(() => {
        const handleUpEvent = e => {
            handlePosEvent(e);
            dragging.current = false;
        }
        document.addEventListener("mousemove", handlePosEvent);
        document.addEventListener("mouseup", handleUpEvent);
        return () => {
            document.removeEventListener("mousemove", handlePosEvent);
            document.removeEventListener("mouseup", handleUpEvent);
        }
    }, []);
    useEffect(() => {
        if (currentTime && !isNaN(currentTime)) {
            setMetadata(data => {
                if (!data) {
                    data = {};
                }
                data.duration = parseInt(playerRef && playerRef.duration);
                data.position = parseInt(currentTime);
                return data;
            });
        }
    }, [currentTime]);
    const events = {
        onMouseDown(e) {
            dragging.current = true;
            handlePosEvent(e, true);
        }
    };
    const play = () => {
        playerRef.play().catch(err => {
            console.error(err);
            setError("PLAYING_ERROR");
        });
    };
    return <div className={styles.root}>
        {error && <MuiAlert className={styles.error} elevation={6} variant="filled" severity="error" action={<Button variant="contained" onClick={() => playerRef.load()} size="small">{translations.RELOAD}</Button>}>{translations[error]}</MuiAlert>}
        <div className={styles.toolbar}>
            <div className={styles.progress}>
                <div className={styles.progressLine} ref={progressRef} {...events}>
                    <div className={styles.progressText}>{progressText}</div>
                    <div className={styles.progressPlayed} style={{ width: left + "%" }} />
                    <div className={styles.progressPosition} style={{ left: progressPosition }} />
                </div>
            </div>
            <div className={styles.buttons}>
                {direction === "ltr" && <PlayerButton icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />}
                {direction === "rtl" && <PlayerButton icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />}
                {error && <PlayerButton icon={<ReplayIcon />} name={translations.RELOAD} onClick={() => playerRef.load()} />}
                {playerRef.paused && !error && <PlayerButton icon={<PlayArrowIcon />} name={translations.PLAY} onClick={play} />}
                {!playerRef.paused && !error && <PlayerButton icon={<PauseIcon />} name={translations.PAUSE} onClick={() => playerRef.pause()} />}
                <PlayerButton icon={<StopIcon />} name={translations.STOP} onClick={() => {
                    playerRef.pause();
                    seekPosition(0);
                }} />
                {direction === "ltr" && <PlayerButton icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />}
                {direction === "rtl" && <PlayerButton icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />}
            </div>
        </div>
    </div>;
}
