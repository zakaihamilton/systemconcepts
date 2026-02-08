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

import { useMediaSession } from "@util/mediaSession";

const skipPoints = 10;

export default function Controls({ show, path, playerRef, metadataPath, metadataKey, zIndex, color, noDuration, sessionName, groupName, sessionDate }) {
    const progressRef = useRef(null);
    const { direction } = MainStore.useState();

    const translations = useTranslations();
    const dragging = useRef(false);
    const [, setCounter] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState(null);
    const visible = usePageVisibility();

    // MediaSession API integration for iOS Bluetooth headset controls
    // Capitalize first letter of artist name
    const capitalizedArtist = groupName ? groupName.charAt(0).toUpperCase() + groupName.slice(1) : "";
    // Include date in title if available (YYYY-MM-DD format, before session name)
    const formattedDate = sessionDate ? new Date(sessionDate).toISOString().split('T')[0] : null;
    const sessionTitle = formattedDate ? `${formattedDate} ${sessionName || "Session"}` : (sessionName || "Session");
    useMediaSession({
        playerRef,
        title: sessionTitle,
        artist: capitalizedArtist,
        enabled: show && !!playerRef
    });
    const [metadata, , , setMetadata] = useFile(metadataPath, [metadataPath, metadataKey], data => {
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
            else if (name === "loadedmetadata") {
                if (!metadataKey) return; // Skip if metadataKey not ready
                const currentMetadata = metadataKey ? (metadata?.[metadataKey] || {}) : (metadata || {});
                if (currentMetadata.position) {
                    playerRef.currentTime = currentMetadata.position; // eslint-disable-line react-hooks/immutability
                    setCurrentTime(playerRef.currentTime);
                }
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
        const events = ["loadedmetadata", "pause", "error", "loadstart", "play", "playing", "timeupdate", "ratechange"];
        const listeners = events.map(name => {
            const callback = () => update(name);
            playerRef.addEventListener(name, callback);
            return { name, callback };
        });
        update("timeupdate");
        return () => {
            listeners.map(({ name, callback }) => playerRef.removeEventListener(name, callback));
        };
    }, [visible, show, metadata, playerRef, metadataKey]);

    useEffect(() => {
        console.log("[Controls] Metadata effect triggered", {
            hasMetadata: !!metadata,
            metadataKey,
            readyState: playerRef?.readyState,
            currentTime: playerRef?.currentTime
        });

        if (!metadataKey) return; // Skip if metadataKey not ready
        if (metadata && playerRef && playerRef.readyState >= 1) {
            const currentMetadata = metadataKey ? (metadata?.[metadataKey] || {}) : (metadata || {});
            console.log("[Controls] Current metadata:", {
                metadataKey,
                currentMetadata,
                position: currentMetadata.position,
                hasMetadataKey: !!metadataKey,
                metadataKeys: Object.keys(metadata).slice(0, 5)
            });

            if (currentMetadata.position && playerRef.currentTime < 1) {

                playerRef.currentTime = currentMetadata.position; // eslint-disable-line react-hooks/immutability
                setCurrentTime(currentMetadata.position);
            } else {
                console.log("[Controls] Not setting position:", {
                    hasPosition: !!currentMetadata.position,
                    currentTime: playerRef.currentTime
                });
            }
        }
    }, [metadata, metadataKey, playerRef]);
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
        if (!noDuration) {
            progressText += " / " + formatDuration(playerRef.duration * 1000);
        }
        progressText += " ( " + translations.TIME_LEFT + " " + formatDuration((playerRef.duration - audioPos) * 1000) + " )";
    }
    const progressPosition = left + "%";
    const handlePosEvent = useCallback(e => {
        // Extract clientX from either mouse or touch event
        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        if (!dragging.current || !clientX) {
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

        // Wrapper for touch events to prevent default only when dragging
        const handleTouchMove = e => {
            if (dragging.current) {
                e.preventDefault();
                handlePosEvent(e);
            }
        };

        const handleTouchEnd = e => {
            if (dragging.current) {
                e.preventDefault();
                handleUpEvent(e);
            }
        };

        // Add both mouse and touch event listeners
        document.addEventListener("mousemove", handlePosEvent);
        document.addEventListener("mouseup", handleUpEvent);
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd, { passive: false });
        return () => {
            document.removeEventListener("mousemove", handlePosEvent);
            document.removeEventListener("mouseup", handleUpEvent);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [handlePosEvent]);
    useEffect(() => {
        if (currentTime && !isNaN(currentTime) && playerRef.duration && metadataKey) {
            setMetadata(data => {
                if (!data) {
                    data = {};
                }
                const duration = parseInt(playerRef && playerRef.duration);
                const position = parseInt(currentTime);

                if (metadataKey) {
                    const subData = data[metadataKey] || {};
                    subData.duration = duration;
                    subData.position = position;
                    return { ...data, [metadataKey]: subData };
                }

                data.duration = duration;
                data.position = position;
                return { ...data };
            });
        }
    }, [currentTime, playerRef, setMetadata, metadataKey]);
    const events = {
        onMouseDown(e) {
            dragging.current = true;
            handlePosEvent(e);
        },
        onTouchStart(e) {
            // Don't call preventDefault here - it's handled in document-level listeners
            dragging.current = true;
            handlePosEvent(e);
        },
        onKeyDown(e) {
            const duration = playerRef.duration;
            if (!duration) return;

            let newPos = currentTime;
            let changed = false;

            switch (e.key) {
                case "ArrowLeft":
                case "ArrowDown":
                    newPos = Math.max(0, currentTime - skipPoints);
                    changed = true;
                    break;
                case "ArrowRight":
                case "ArrowUp":
                    newPos = Math.min(duration, currentTime + skipPoints);
                    changed = true;
                    break;
                case "Home":
                    newPos = 0;
                    changed = true;
                    break;
                case "End":
                    newPos = duration;
                    changed = true;
                    break;
            }

            if (changed) {
                e.preventDefault();
                seekPosition(newPos);
            }
        },
        onContextMenu(e) {
            e.preventDefault(); // Prevent right-click menu
        }
    };
    const play = () => {
        playerRef.play().catch(err => {
            console.error(err);
        });
    };
    const stop = useCallback(() => {
        playerRef.pause();
        playerRef.currentTime = 0; // eslint-disable-line react-hooks/immutability
        setCurrentTime(0);
    }, [playerRef]);

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
        <div className={styles.root} style={{ zIndex }}>
            <div className={styles.progress}>
                <div className={styles.progressLine}>
                    <div
                        className={styles.progressBack}
                        ref={progressRef}
                        {...events}
                        tabIndex={0}
                        role="slider"
                        aria-label={translations.SEEK}
                        aria-valuemin={0}
                        aria-valuemax={playerRef.duration || 0}
                        aria-valuenow={currentTime}
                        aria-valuetext={progressText}
                    />
                    <div className={styles.progressText}>{progressText}</div>
                    <div className={styles.progressPlayed} style={{ width: left + "%", backgroundColor: color }} />
                    <div className={styles.progressPosition} style={{ left: progressPosition, backgroundColor: color }} />
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
