import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import SpeedIcon from "@mui/icons-material/Speed";
import { useState, useEffect } from "react";
import { useDeviceType } from "@util/styles";
import { PlayerStore } from "../Player";

registerToolbar("PlayerToolbar");

export default function Toolbar({ show, playerRef, isVideo }) {
    const isMobile = useDeviceType() !== "desktop";
    const translations = useTranslations();
    const { showSpeed } = PlayerStore.useState();
    const [, setCounter] = useState(0);
    useEffect(() => {
        const update = () => {
            setCounter(counter => counter + 1);
        };
        const events = ["ratechange"];
        const listeners = events.map(name => {
            const callback = () => update(name);
            playerRef.addEventListener(name, callback);
            return { name, callback };
        });
        return () => {
            listeners.forEach(({ name, callback }) => playerRef.removeEventListener(name, callback));
        };
    }, []);

    const speed = playerRef.playbackRate || 1.0;

    const menuItems = [
        {
            id: "speed",
            name: translations.SPEED,
            icon: <SpeedIcon />,
            active: showSpeed,
            onClick: () => {
                PlayerStore.update(s => {
                    s.showSpeed = !s.showSpeed;
                });
            },
            location: "header",
            divider: true
        },
        isVideo && {
            id: "fullscreen",
            name: translations.FULLSCREEN,
            icon: <FullscreenIcon />,
            onClick: () => playerRef.requestFullscreen(),
            location: "header"
        }
    ].filter(Boolean);

    useToolbar({ id: "PlayerToolbar", visible: show, items: menuItems, depends: [speed, showSpeed, isMobile, isVideo, translations] });
    return null;
}
