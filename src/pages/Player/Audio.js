import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";
import { PlayerStore } from "../Player";
import styles from "./Audio.module.scss";
import Group from "@components/Widgets/Group";
import { useDateFormatter } from "@util/locale";
import { formatDuration } from "@util/string";
import { useDeviceType } from "@util/styles";
import clsx from "clsx";

export default function Audio({ show, metadataPath, metadataKey, name, path, date, group, color, children, elements, showDetails, ...props }) {
    const isMobile = useDeviceType() !== "desktop";
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        setPlayerRef(ref.current);
        return () => {
            setPlayerRef(null);
        };
    }, []);

    useEffect(() => {
        PlayerStore.update(s => {
            s.player = playerRef;
        });
    }, [playerRef]);

    useEffect(() => {
        if (!playerRef) return;

        const handleDurationChange = () => {
            setDuration(playerRef.duration || 0);
        };

        // Set initial duration if already loaded
        if (playerRef.duration) {
            setDuration(playerRef.duration);
        }

        playerRef.addEventListener('durationchange', handleDurationChange);

        return () => {
            playerRef.removeEventListener('durationchange', handleDurationChange);
        };
    }, [playerRef]);

    useEffect(() => {
        if (ref.current) {
            const tracks = ref.current.textTracks;
            if (tracks && tracks[0]) {
                tracks[0].mode = 'showing';
            }
        }
    }, [children]);

    const dateFormatter = useDateFormatter({
        weekday: "long",
        year: "numeric",
        month: isMobile ? "short" : "long",
        day: "numeric"
    });

    let dateWidget = "";
    try {
        dateWidget = date && dateFormatter.format(new Date(date));
    }
    catch (err) {
        console.error("err", err);
    }

    const { style, ...rest } = props;
    return <div className={styles.root} style={style}>
        <div className={clsx(styles.container, !showDetails && styles.collapsed)}>
            <div className={styles.card} style={{ '--group-color': color }}>
                <div className={styles.header}>
                    <div className={styles.headerRow}>
                        <div className={styles.title}>{name}</div>
                    </div>
                    <div className={styles.metadata}>
                        <Group fill={false} name={group} color={color} />
                        <span className={styles.date}>{dateWidget}</span>
                        {duration > 1 && <span className={styles.duration}>{formatDuration(duration * 1000, true)}</span>}
                    </div>
                </div>
            </div>
        </div>
        {elements}
        <video ref={ref} className={styles.video} {...rest}>
            {children}
        </video>
        {playerRef && <Controls
            playerRef={playerRef}
            color={color}
            noDuration={true}
            metadataPath={metadataPath}
            metadataKey={metadataKey}
            path={path}
            show={show}
            zIndex={1}
            sessionName={name}
            groupName={group}
            sessionDate={date}
        />}
        {playerRef && <Toolbar show={show} name={name} playerRef={playerRef} isVideo={false} />}
    </div>;
}
