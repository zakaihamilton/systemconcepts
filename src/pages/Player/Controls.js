import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Controls.module.scss";
import { useTranslations } from "@/util/translations";
import PlayerButton from "./Button";
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import ReplayIcon from '@material-ui/icons/Replay';
import PauseIcon from '@material-ui/icons/Pause';
import { formatDuration } from "@/util/string";
import { MainStore } from "@/components/Main";
import MuiAlert from '@material-ui/lab/Alert';
import Forward10Icon from '@material-ui/icons/Forward10';
import Replay10Icon from '@material-ui/icons/Replay10';
import TimelapseIcon from '@material-ui/icons/Timelapse';
import Tooltip from '@material-ui/core/Tooltip';

const skipPoints = 10;

export default function Controls({ playerRef, metadata, setMetadata }) {
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
        const events = ["loadedmetadata", "pause", "error", "loadstart", "play", "playing", "timeupdate"];
        events.map(name => playerRef.addEventListener(name, () => update(name)));
        return () => {
            events.map(name => playerRef.removeEventListener(name, update));
        };
    }, []);
    const seekPosition = useCallback(position => {
        if (isNaN(position)) {
            return;
        }
        playerRef.currentTime = position;
        setCurrentTime(position);
    }, []);
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
                return { ...data };
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
        });
    };

    const timestamps = metadata && metadata.timestamps || [];
    const timestampPos = parseInt(currentTime);
    const timestamp = timestamps.find(item => item.id === timestampPos);
    const hasTimestamp = !!timestamp;

    const toggleTimestamp = () => {
        setMetadata(metadata => {
            metadata.timestamps = metadata.timestamps || [];
            if (hasTimestamp) {
                metadata.timestamps = metadata.timestamps.filter(item => item.id !== timestampPos);
            }
            else {
                metadata.timestamps = [...metadata.timestamps, {
                    id: timestampPos
                }];
                metadata.timestamps.sort((a, b) => a.id - b.id);
            }
            setCounter(counter => counter + 1);
            return { ...metadata };
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
                    {timestamps.map(item => {
                        const pos = item.id / playerRef.duration * 100;
                        const name = <>
                            <div>{item.name}</div>
                            <div>{formatDuration(item.id * 1000, true)}</div>
                        </>
                            ;
                        return <Tooltip arrow title={name}>
                            <div key={item.id} className={styles.progressTimestamp} style={{ left: pos + "%" }} />
                        </Tooltip>;
                    })}
                </div>
            </div>
            <div className={styles.buttons}>
                {direction === "ltr" && <PlayerButton icon={<Replay10Icon />} name={translations.REPLAY + " 10"} onClick={replay} />}
                {direction === "rtl" && <PlayerButton icon={<Forward10Icon />} name={translations.FORWARD + " 10"} onClick={forward} />}
                {error && <PlayerButton icon={<ReplayIcon />} name={translations.RELOAD} onClick={() => playerRef.load()} />}
                {playerRef.paused && !error && <PlayerButton icon={<PlayArrowIcon />} name={translations.PLAY} onClick={play} />}
                {!playerRef.paused && !error && <PlayerButton icon={<PauseIcon />} name={translations.PAUSE} onClick={() => playerRef.pause()} />}
                {direction === "ltr" && <PlayerButton icon={<Forward10Icon />} name={translations.FORWARD + " 10"} onClick={forward} />}
                {direction === "rtl" && <PlayerButton icon={<Replay10Icon />} name={translations.REPLAY + " 10"} onClick={replay} />}
                <PlayerButton active={hasTimestamp} icon={<TimelapseIcon />} name={hasTimestamp ? translations.REMOVE_TIMESTAMP : translations.ADD_TIMESTAMP} onClick={toggleTimestamp}></PlayerButton>
            </div>
        </div>
    </div>;
}
