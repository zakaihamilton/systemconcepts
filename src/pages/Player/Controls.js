import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Controls.module.scss";
import { useTranslations } from "@util/translations";
import PlayerButton from "./Button";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import StopIcon from "@mui/icons-material/Stop";
import PauseIcon from "@mui/icons-material/Pause";
import { formatDuration } from "@util/string";
import { MainStore } from "@components/Main";
import MuiAlert from '@mui/material/Alert';
import Forward10Icon from "@mui/icons-material/Forward10";
import Replay10Icon from "@mui/icons-material/Replay10";
import { usePageVisibility } from "@util/hooks";
import { useFile } from "@util/storage";
import Button from "@mui/material/Button";

const skipPoints = 10;

export default function Controls({ show, path, playerRef, metadataPath, zIndex }) {
    const progressRef = useRef(null);
    const { direction } = MainStore.useState();


    const translations = useTranslations();
    const dragging = useRef(false);
    const [, setCounter] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState(null);
    const visible = usePageVisibility();
    const [metadata, , , setMetadata] = useFile(metadataPath, [metadataPath], data => {
        return data ? JSON.parse(data) : {};
    });

    const lastUpdateTimeRef = useRef(0);

    useEffect(() => {
        const update = name => {
            if (name === "error") {
                setError("PLAYING_ERROR");
            }
            else if (name === "loadstart") {
                setError(null);
            }
            else if (name === "loadedmetadata" && metadata && metadata.position) {
                playerRef.currentTime = metadata.position; // eslint-disable-line react-hooks/immutability
                setCurrentTime(playerRef.currentTime);
            }
            if (name === "timeupdate" && !dragging.current) {
                const currentTime = parseInt(playerRef.currentTime);

                if (visible && show) {
                    // When visible, update on every timeupdate
                    setCurrentTime(currentTime);
                    lastUpdateTimeRef.current = currentTime;
                } else {
                    // When not visible, only update every 10 seconds
                    if (Math.abs(currentTime - lastUpdateTimeRef.current) >= 10) {
                        setCurrentTime(currentTime);
                        lastUpdateTimeRef.current = currentTime;
                    }
                }
            }
            else {
                setCounter(counter => counter + 1);
            }
        };
        const events = ["loadedmetadata", "pause", "error", "loadstart", "play", "playing", "timeupdate"];
        const listeners = events.map(name => {
            const callback = () => update(name);
            playerRef.addEventListener(name, callback);
            return { name, callback };
        });
        update("timeupdate");
        return () => {
            listeners.map(({ name, callback }) => playerRef.removeEventListener(name, callback));
        };
    }, [visible, show, metadata, playerRef]);
    const seekPosition = useCallback(position => {
        if (isNaN(position)) {
            return;
        }
        playerRef.currentTime = position; // eslint-disable-line react-hooks/immutability
        setCurrentTime(position);
    }, [playerRef]);
    const replay = () => {
        let position = currentTime;
        if (position > skipPoints) {
            position -= skipPoints;
        }
        else {
            position = 0;
        }
        seekPosition(position);
    };
    const forward = () => {
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
    const progressPosition = left + "%";
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
    }, [playerRef, seekPosition]);
    useEffect(() => {
        const handleUpEvent = e => {
            handlePosEvent(e);
            dragging.current = false;
        };
        document.addEventListener("mousemove", handlePosEvent);
        document.addEventListener("mouseup", handleUpEvent);
        return () => {
            document.removeEventListener("mousemove", handlePosEvent);
            document.removeEventListener("mouseup", handleUpEvent);
        };
    }, [handlePosEvent]);
    useEffect(() => {
        if (currentTime && !isNaN(currentTime) && playerRef.duration) {
            setMetadata(data => {
                if (!data) {
                    data = {};
                }
                data.duration = parseInt(playerRef && playerRef.duration);
                data.position = parseInt(currentTime);
                return { ...data };
            });
        }
    }, [currentTime, playerRef, setMetadata]);
    const events = {
        onMouseDown(e) {
            dragging.current = true;
            handlePosEvent(e, true);
        }
    };
    const play = () => {
        playerRef.play().catch(err => {
            console.error(err);
        });
    };
    const stop = () => {
        playerRef.pause();
        playerRef.currentTime = 0; // eslint-disable-line react-hooks/immutability
    };

    const prevPath = useRef(path);
    useEffect(() => {
        if (prevPath.current === path) {
            return;
        }
        prevPath.current = path;
        stop();
        playerRef.load();
    }, [path, playerRef, stop]);

    return <>
        {error && <MuiAlert className={styles.error} elevation={6} variant="filled" severity="error" action={<Button variant="contained" onClick={() => playerRef.load()} size="small">{translations.RELOAD}</Button>}>{translations[error]}</MuiAlert>}
        <div className={styles.toolbar} style={{ zIndex }}>
            <div className={styles.progress}>
                <div className={styles.progressLine}>
                    <div className={styles.progressBack} ref={progressRef} {...events} />
                    <div className={styles.progressText}>{progressText}</div>
                    <div className={styles.progressPlayed} style={{ width: left + "%" }} />
                    <div className={styles.progressPosition} style={{ left: progressPosition }} />
                </div>
            </div>
            <div className={styles.buttons}>
                {direction === "ltr" && <PlayerButton icon={<Replay10Icon />} name={translations.REPLAY + " 10"} onClick={replay} />}
                {direction === "rtl" && <PlayerButton icon={<Forward10Icon />} name={translations.FORWARD + " 10"} onClick={forward} />}
                {!!error && <PlayerButton icon={<ReplayIcon />} name={translations.RELOAD} onClick={() => playerRef.load()} />}
                {playerRef.paused && !error && <PlayerButton icon={<PlayArrowIcon />} name={translations.PLAY} onClick={play} />}
                {!playerRef.paused && !error && <PlayerButton icon={<PauseIcon />} name={translations.PAUSE} onClick={() => playerRef.pause()} />}
                {!error && <PlayerButton icon={<StopIcon />} name={translations.STOP} onClick={stop} />}
                {direction === "ltr" && <PlayerButton icon={<Forward10Icon />} name={translations.FORWARD + " 10"} onClick={forward} />}
                {direction === "rtl" && <PlayerButton icon={<Replay10Icon />} name={translations.REPLAY + " 10"} onClick={replay} />}
            </div>
        </div>
    </>;
}
