import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./Toolbar.module.scss";
import { useTranslations } from "@/util/translations";
import Button from "./Button";
import FastRewindIcon from '@material-ui/icons/FastRewind';
import FastForwardIcon from '@material-ui/icons/FastForward';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import StopIcon from '@material-ui/icons/Stop';
import { useAudioPlayer, useAudioPosition } from "react-use-audio-player"
import { formatDuration } from "@/util/string";
import { getEmValueFromElement } from "@/util/size";

export default function Tooolbar({ }) {
    const progressRef = useRef(null);
    const audioPlayer = useAudioPlayer({});
    const audioPosition = useAudioPosition({});
    const translations = useTranslations();
    const [dragging, setDragging] = useState(false);
    const [pos, setPos] = useState(0);
    const [width, setWidth] = useState(0);
    const rewind = () => {
        let position = audioPosition.position;
        if (position > 30) {
            position -= 30;
        }
        else {
            position = 0;
        }
        audioPosition.seek(position);
    };
    const fastforward = () => {
        let position = audioPosition.position;
        if (position > audioPosition.duration - 30) {
            position = audioPosition.duration;
        }
        else {
            position += 30;
        }
        audioPosition.seek(position);
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
            audioPosition.seek(position);
        }
    }, [audioPosition, pos, width]);
    useEffect(() => {
        if (dragging) {
            seek(pos);
        }
    }, [pos, dragging]);
    const events = {
        onMouseDown(e) {
            setDragging(true);
            handlePosEvent(e);
        }
    };
    return <div className={styles.root}>
        <div className={styles.toolbar}>
            <div className={styles.progress}>
                <div className={styles.progressLine} ref={progressRef} {...events}>
                    <div className={styles.progressText}>{progressText}</div>
                    <div className={styles.progressPlayed} style={{ width: left + "%" }} />
                    <div className={styles.progressPosition} style={{ left: progressPosition }} />
                </div>
            </div>
            <div className={styles.buttons}>
                <Button icon={<FastRewindIcon />} name={translations.REWIND} onClick={rewind} />
                {!audioPlayer.playing && <Button icon={<PlayArrowIcon />} name={translations.PLAY} onClick={() => audioPlayer.play()} />}
                {audioPlayer.playing && <Button icon={<PauseIcon />} name={translations.PAUSE} onClick={() => audioPlayer.pause()} />}
                <Button icon={<StopIcon />} name={translations.STOP} onClick={() => {
                    audioPlayer.stop()
                    audioPosition.seek(0);
                }} />
                <Button icon={<FastForwardIcon />} name={translations.FAST_FORWARD} onClick={fastforward} />
            </div>
        </div>
    </div>;
}
