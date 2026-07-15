import SpeedIcon from "@icons/svg/Speed.svg";
import Slider from "@ui/Slider";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import React, { useEffect } from "react";
import { MainStore } from "../../../components/Main";
import { PlayerStore } from "../Player";
import styles from "./SpeedSlider.module.css";

export default function SpeedSlider() {
	const translations = useTranslations();
	const { player, showSpeed } = PlayerStore.useState();
	const { speedToolbar } = MainStore.useState();

	const [, setCounter] = React.useState(0);

	useEffect(() => {
		if (!player) return;
		const update = () => setCounter((c) => c + 1);
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
		SPEED_2_0: 2.0,
	};

	// Hide labels for intermediate speeds
	const hiddenLabels = [1.1, 1.25, 1.3, 1.35, 1.4, 1.45];

	const speedMarks = Object.entries(rateItems)
		.map(([, value]) => ({
			value,
			label: hiddenLabels.includes(value) ? "" : value + "x",
		}))
		.sort((a, b) => a.value - b.value);

	const getSpeedLabel = (value) => {
		const entry = Object.entries(rateItems).find(([, val]) => val === value);
		if (entry) {
			const [name] = entry;
			const label = translations[name];
			if (label) {
				return label;
			}
		}
		return value + "x";
	};

	const getSpeedName = (value) => {
		const label = getSpeedLabel(value);
		return label === `${value}x` ? label : `${label} (${value}x)`;
	};

	const handleSpeedChange = (_event, newValue) => {
		const audio = player;
		audio.playbackRate = newValue; // eslint-disable-line react-hooks/immutability
	};

	const currentRate = player.playbackRate || 1.0;
	const currentSpeedLabel = getSpeedLabel(currentRate);
	const hasCurrentSpeedLabel = currentSpeedLabel !== `${currentRate}x`;
	const max = Math.max(...Object.values(rateItems));

	return (
		<section
			className={clsx(styles.root, styles[speedToolbar])}
			aria-label={translations.SPEED}
		>
			<div className={styles.panel}>
				<div className={styles.header}>
					<div className={styles.title}>
						<SpeedIcon className={styles.icon} aria-hidden="true" />
						<span>{translations.SPEED}</span>
					</div>
					<output className={styles.currentRate} aria-live="polite">
						{hasCurrentSpeedLabel && <span>{currentSpeedLabel}</span>}
						<strong>{currentRate}×</strong>
					</output>
				</div>
				<div className={styles.sliderContainer}>
					<Slider
						aria-label={translations.SPEED}
						value={currentRate}
						valueLabelDisplay="auto"
						valueLabelFormat={getSpeedName}
						step={null}
						marks={speedMarks}
						min={0.5}
						max={max}
						onChange={handleSpeedChange}
						className={styles.speedSlider}
					/>
				</div>
			</div>
		</section>
	);
}
