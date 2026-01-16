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
        SPEED_1_30: 1.3,
        SPEED_1_35: 1.35,
        SPEED_1_40: 1.4,
        SPEED_1_45: 1.45,
        SPEED_VERY_FAST: 1.5,
        SPEED_SUPER_FAST: 1.75,
        SPEED_2_0: 2.0
    };

    // Hide labels for intermediate speeds
    const hiddenLabels = [1.1, 1.25, 1.3, 1.35, 1.4, 1.45];

    const speedMarks = Object.entries(rateItems).map(([, value]) => ({
        value,
        label: hiddenLabels.includes(value) ? "" : value + "x"
    })).sort((a, b) => a.value - b.value);

    const getSpeedName = (value) => {
        const entry = Object.entries(rateItems).find(([, val]) => val === value);
        if (entry) {
            const [name] = entry;
            const label = translations[name];
            if (label) {
                return `${label} (${value}x)`;
            }
        }
        return value + "x";
    };

    const handleSpeedChange = (event, newValue) => {
        // eslint-disable-next-line
        player.playbackRate = newValue;
    };

    const max = Math.max(...Object.values(rateItems));

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
                    max={max}
                    onChange={handleSpeedChange}
                    sx={{
                        '& .MuiSlider-rail': {
                            height: 8,
                        },
                        '& .MuiSlider-track': {
                            height: 8,
                        },
                        '& .MuiSlider-thumb': {
                            width: 24,
                            height: 24,
                        },
                        '& .MuiSlider-mark': {
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: 'currentColor',
                        },
                        '& .MuiSlider-markActive': {
                            backgroundColor: 'currentColor',
                            opacity: 1,
                        }
                    }}
                />
            </div>
        </div>
    );
}
