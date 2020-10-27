import styles from "./Toolbar.module.scss";
import Avatar from '@material-ui/core/Avatar';
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import VolumeDownIcon from '@material-ui/icons/VolumeDown';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import SpeedIcon from '@material-ui/icons/Speed';
import { useState, useEffect } from "react";
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { addPath } from "@util/pages";
import { useDeviceType } from "@util/styles";
import Tooltip from '@material-ui/core/Tooltip';

registerToolbar("PlayerToolbar");

export default function Toolbar({ show, playerRef, name, isVideo }) {
    const isMobile = useDeviceType() !== "desktop";
    const translations = useTranslations();
    const [, setCounter] = useState(0);
    useEffect(() => {
        const update = name => {
            setCounter(counter => counter + 1);
        };
        const events = ["ratechange", "volumechange"];
        const listeners = events.map(name => {
            const callback = () => update(name);
            playerRef.addEventListener(name, callback);
            return { name, callback };
        });
        return () => {
            listeners.forEach(({ name, callback }) => playerRef.removeEventListener(name, callback));
        };
    }, []);

    const rateItems = {
        SPEED_SLOW: 0.5,
        SPEED_SLOWER: 0.75,
        SPEED_NORMAL: 1.0,
        SPEED_FASTER: 1.25,
        SPEED_FAST: 1.5,
        SPEED_SUPER_FAST: 1.75,
        SPEED_DOUBLE: 2.0,
        SPEED_TRIPLE: 3.0
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

    const menuItems = [
        {
            id: "speed",
            name: translations.SPEED,
            icon: <SpeedIcon />,
            items: rateMenuItems,
            selected: speed,
            location: "footer",
            label: true,
            divider: true
        },
        {
            id: "volume",
            name: translations.VOLUME,
            icon: <VolumeDownIcon />,
            items: volumeMenuItems,
            selected: volume,
            divider: true,
            label: true,
            location: "footer"
        },
        isMobile && {
            id: "name",
            element:
                <>
                    <Tooltip arrow title={name}>
                        <div className={styles.name}>
                            {name}
                        </div>
                    </Tooltip>
                    <div style={{ flex: 1 }} />
                </>,
            location: "header"
        },
        isVideo && {
            id: "fullscreen",
            name: translations.FULLSCREEN,
            icon: <FullscreenIcon />,
            onClick: () => playerRef.requestFullscreen(),
            location: "footer"
        },
        {
            id: "timestamps",
            name: translations.TIMESTAMPS,
            icon: <AccessTimeIcon />,
            location: "header",
            onClick: () => addPath("timestamps")
        }
    ].filter(Boolean);

    useToolbar({ id: "PlayerToolbar", visible: show, items: menuItems, depends: [speed, volume, isMobile, translations] });
    return null;
}
