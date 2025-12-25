import React, { useEffect } from "react";
import Slider from "@mui/material/Slider";
import { useTranslations } from "@util/translations";
import { PlayerStore } from "../Player";
import clsx from "clsx";
import styles from "./SpeedSlider.module.scss";
import { MainStore } from "../../components/Main";

export default function SpeedSlider() {
    const translations = useTranslations();
    const { player, showSpeed } = PlayerStore.useState();
    const { speedToolbar } = MainStore.useState();

    const [, setCounter] = React.useState(0);

    useEffect(() => {
        if (!player) return;
        const update = () => setCounter(c => c + 1);
        player.addEventListener("ratechange", update);
        return () => player.removeEventListener("ratechange", update);
    }, [player]);

    if (!showSpeed || !player) {
        return null;
    }

    const rateItems = {
        SPEED_SLOW: 0.5,
        SPEED_SLOWER: 0.75,
        SPEED_NORMAL: 1.0,
        SPEED_FASTER: 1.1,
        SPEED_FAST: 1.25,
        SPEED_VERY_FAST: 1.5,
        SPEED_SUPER_FAST: 1.75,
        SPEED_DOUBLE: 2.0
    };

    const speedMarks = Object.entries(rateItems).map(([name, value]) => ({
        value,
        label: value + "x"
    })).sort((a, b) => a.value - b.value);

    const getSpeedName = (value) => {
        const entry = Object.entries(rateItems).find(([, val]) => val === value);
        if (entry) {
            const [name] = entry;
            return translations[name] || name.replace('SPEED_', '').split('_').map(word =>
                word.charAt(0) + word.slice(1).toLowerCase()
            ).join(' ');
        }
        return value + "x";
    };

    const handleSpeedChange = (event, newValue) => {
        player.playbackRate = newValue;
    };

    return (
        <div className={clsx(styles.root, styles[speedToolbar])}>
            <div className={styles.sliderContainer}>
                <Slider
                    aria-label={translations.SPEED}
                    value={player.playbackRate || 1.0}
                    valueLabelDisplay="auto"
                    valueLabelFormat={getSpeedName}
                    step={null}
                    marks={speedMarks}
                    min={0.5}
                    max={2.0}
                    onChange={handleSpeedChange}
                />
            </div>
        </div>
    );
}
