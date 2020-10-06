import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AudioControls.module.scss";
import { useTranslations } from "@/util/translations";
import Button from "../Button";
import FastRewindIcon from '@material-ui/icons/FastRewind';
import FastForwardIcon from '@material-ui/icons/FastForward';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import SpeedIcon from '@material-ui/icons/Speed';
import { formatDuration } from "@/util/string";
import Menu from "@/widgets/Menu";
import Avatar from '@material-ui/core/Avatar';
import { MainStore } from "@/components/Main";
import Field from "../Field";
import VolumeDownIcon from '@material-ui/icons/VolumeDown';

const skipPoints = 10;

export default function AudioControls({ playerRef, metadata, setMetadata, path = "", group = "", year = "", name = "" }) {
    const progressRef = useRef(null);
    const { direction } = MainStore.useState();
    const translations = useTranslations();
    const dragging = useRef(false);
    const [, setCounter] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    useEffect(() => {
        const update = name => {
            if (name === "loadedmetadata" && metadata && metadata.position) {
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
        const events = ["loadedmetadata", "pause", "play", "playing", "volumechange", "timeupdate"];
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
    const rateItems = {
        SPEED_SLOW: 0.5,
        SPEED_SLOWER: 0.75,
        SPEED_NORMAL: 1.0,
        SPEED_FASTER: 1.25,
        SPEED_FAST: 1.5
    };
    const rateMenuItems = Object.entries(rateItems).map(([name, rate]) => {
        return {
            id: rate,
            icon: <Avatar className={styles.avatar} variant="square">{rate.toFixed(2)}</Avatar>,
            name: translations[name],
            onClick: () => playerRef.playbackRate = rate
        }
    });
    const volumeItems = {
        LOW_VOLUME: 0.5,
        MEDIUM_VOLUME: 0.75,
        HIGH_VOLUME: 1.0
    };
    const volumeMenuItems = Object.entries(volumeItems).map(([name, level]) => {
        return {
            id: level,
            icon: <Avatar className={styles.avatar} variant="square">{level.toFixed(2)}</Avatar>,
            name: translations[name],
            onClick: () => playerRef.volume = level
        }
    });
    const speed = playerRef.playbackRate || 1.0;
    const volume = playerRef.volume;
    const rateId = Object.keys(rateItems).find(rateId => rateItems[rateId] === speed);
    const volumeId = Object.keys(volumeItems).find(volumeId => volumeItems[volumeId] === volume);
    const speedName = translations[rateId];
    const volumeName = translations[volumeId];
    let [, month, day, sessionName = ""] = name.split(/(\d{4})-(\d{2})-(\d{2})\s(.+)/g).slice(1);
    const date = [year, month, day].join("-");
    return <div className={styles.root}>
        <div className={styles.metadata}>
            <Field name={translations.GROUP} value={group && (group[0].toUpperCase() + group.slice(1))} />
            <Field name={translations.DATE} value={date} />
            <Field name={translations.NAME} value={sessionName} />
        </div>
        <div className={styles.toolbar}>
            <div className={styles.progress}>
                <div className={styles.progressLine} ref={progressRef} {...events}>
                    <div className={styles.progressText}>{progressText}</div>
                    <div className={styles.progressPlayed} style={{ width: left + "%" }} />
                    <div className={styles.progressPosition} style={{ left: progressPosition }} />
                </div>
            </div>
            <div className={styles.buttons}>
                {direction === "ltr" && <Button icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />}
                {direction === "rtl" && <Button icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />}
                {playerRef.paused && <Button icon={<PlayArrowIcon />} name={translations.PLAY} onClick={() => playerRef.play()} />}
                {!playerRef.paused && <Button icon={<PauseIcon />} name={translations.PAUSE} onClick={() => playerRef.pause()} />}
                <Button icon={<StopIcon />} name={translations.STOP} onClick={() => {
                    playerRef.pause();
                    seekPosition(0);
                }} />
                {direction === "ltr" && <Button icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />}
                {direction === "rtl" && <Button icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />}
                <div style={{ flex: 1 }} />
                <Menu items={rateMenuItems} selected={speed}>
                    <Button icon={<SpeedIcon />} name={translations.SPEED} subHeading={speedName} />
                </Menu>
                <Menu items={volumeMenuItems} selected={volume}>
                    <Button icon={<VolumeDownIcon />} name={translations.VOLUME} subHeading={volumeName} />
                </Menu>
            </div>
        </div>
    </div>;
}