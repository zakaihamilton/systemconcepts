import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./Player.module.scss";
import { useTranslations } from "@/util/translations";
import Button from "./Button";
import FastRewindIcon from '@material-ui/icons/FastRewind';
import FastForwardIcon from '@material-ui/icons/FastForward';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import SpeedIcon from '@material-ui/icons/Speed';
import { useAudioPlayer, useAudioPosition } from "react-use-audio-player"
import { formatDuration } from "@/util/string";
import Menu from "@/widgets/Menu";
import Avatar from '@material-ui/core/Avatar';
import { MainStore } from "@/components/Main";
import Field from "./Field";

const skipPoints = 10;

export default function Tooolbar({ setMetadata, group, year, name }) {
    const progressRef = useRef(null);
    const { direction } = MainStore.useState();
    const audioPlayer = useAudioPlayer({});
    const audioPosition = useAudioPosition({});
    const translations = useTranslations();
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState(0);
    const [width, setWidth] = useState(0);
    const seekPosition = useCallback(position => {
        setMetadata(data => {
            if (data) {
                data.position = parseInt(position);
            }
            return data;
        });
        audioPosition.seek(position);
    }, []);
    const rewind = () => {
        let position = audioPosition.position;
        if (position > skipPoints) {
            position -= skipPoints;
        }
        else {
            position = 0;
        }
        seekPosition(position);
    };
    const fastforward = () => {
        let position = audioPosition.position;
        if (position > audioPosition.duration - skipPoints) {
            position = audioPosition.duration;
        }
        else {
            position += skipPoints;
        }
        seekPosition(position);
    };
    const left = audioPosition.position / audioPosition.duration * 100;
    const audioPos = isNaN(audioPosition.position) ? 0 : audioPosition.position;
    const progressText = formatDuration(audioPos * 1000) + " / " + formatDuration(audioPosition.duration * 1000);
    const progressPosition = `calc(${left}%)`;
    const handlePosEvent = useCallback(e => {
        const { clientX } = e;
        const pos = clientX - progressRef.current.getBoundingClientRect().left;
        setPos(pos);
        const width = progressRef.current.clientWidth;
        setWidth(width);
    }, []);
    useEffect(() => {
        const handleUpEvent = () => {
            setDragging(false);
        }
        document.addEventListener("mousemove", handlePosEvent);
        document.addEventListener("mouseup", handleUpEvent);
        return () => {
            document.removeEventListener("mousemove", handlePosEvent);
            document.addEventListener("mouseup", handleUpEvent);
        }
    }, []);
    const seek = useCallback(() => {
        const ratio = audioPosition.duration / width;
        let position = pos * ratio;
        if (position < 0) {
            position = 0;
        }
        else if (position > audioPosition.duration) {
            position = audioPosition.duration;
        }
        if (!isNaN(position)) {
            seekPosition(position);
        }
    }, [audioPosition, pos, width]);
    useEffect(() => {
        if (dragging) {
            seek(pos);
        }
    }, [pos, dragging]);
    useEffect(() => {
        if (audioPosition.position && !isNaN(audioPosition.position)) {
            setMetadata(data => {
                if (data) {
                    data.position = parseInt(audioPosition.position);
                }
                return data;
            });
        }
    }, [audioPosition.position]);
    const events = {
        onMouseDown(e) {
            setDragging(true);
            handlePosEvent(e);
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
            icon: <Avatar className={styles.rateAvatar} variant="square">{rate}</Avatar>,
            name: translations[name],
            onClick: () => audioPlayer.player.rate(rate)
        }
    });
    const speed = audioPlayer.player.rate();
    const speedName = translations[Object.entries(rateItems).find(([, rate]) => rate === speed)[0]];
    let [, month, day, sessionName = ""] = name.split(/(\d{4})-(\d{2})-(\d{2})\s(.+)/g).slice(1);
    const date = [year, month, day].join("-");
    return <div className={styles.root}>
        <div className={styles.metadata}>
            <Field name={translations.GROUP} value={group[0].toUpperCase() + group.slice(1)} />
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
                {!audioPlayer.playing && <Button icon={<PlayArrowIcon />} name={translations.PLAY} onClick={() => audioPlayer.play()} />}
                {audioPlayer.playing && <Button icon={<PauseIcon />} name={translations.PAUSE} onClick={() => audioPlayer.pause()} />}
                <Button icon={<StopIcon />} name={translations.STOP} onClick={() => {
                    audioPlayer.stop()
                    seekPosition(0);
                }} />
                {direction === "ltr" && <Button icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />}
                {direction === "rtl" && <Button icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />}
                <div style={{ flex: 1 }} />
                <Menu items={rateMenuItems} selected={speed}>
                    <Button icon={<SpeedIcon />} name={translations.SPEED} subHeading={speedName} />
                </Menu>
            </div>
        </div>
    </div>;
}
