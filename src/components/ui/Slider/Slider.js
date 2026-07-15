import clsx from "clsx";
import { useRef, useState } from "react";
import styles from "../shared.module.css";

export default function Slider({
	value,
	onChange,
	min = 0,
	max = 100,
	step = 1,
	marks,
	valueLabelDisplay,
	valueLabelFormat,
	className,
	style,
	"aria-label": ariaLabel,
	...props
}) {
	const [showLabel, setShowLabel] = useState(false);
	const sliderRef = useRef(null);
	const discreteMarks =
		step === null && marks?.length
			? [...marks]
					.sort((a, b) => a.value - b.value)
					.filter(
						(mark, index, sortedMarks) =>
							index === 0 || mark.value !== sortedMarks[index - 1].value,
					)
			: null;
	const selectedMarkIndex = discreteMarks
		? Math.max(
				0,
				discreteMarks.findIndex((mark) => mark.value === value),
			)
		: null;
	const inputValue = value;
	const inputMin = min;
	const inputMax = max;
	const inputStep = discreteMarks
		? Number(
				Math.min(
					...discreteMarks.slice(1).map((mark, index) => {
						return mark.value - discreteMarks[index].value;
					}),
				).toFixed(10),
			)
		: step;
	const progress =
		inputMax === inputMin
			? 0
			: ((inputValue - inputMin) / (inputMax - inputMin)) * 100;

	const handleChange = (e) => {
		const inputNumber = Number(e.target.value);
		const newValue = discreteMarks
			? discreteMarks.reduce((closestMark, mark) =>
					Math.abs(mark.value - inputNumber) <
					Math.abs(closestMark.value - inputNumber)
						? mark
						: closestMark,
				).value
			: inputNumber;
		onChange?.(e, newValue);
	};

	const displayValue = valueLabelFormat ? valueLabelFormat(value) : value;

	return (
		<div
			className={clsx(className)}
			style={{ position: "relative", width: "100%" }}
		>
			<input
				ref={sliderRef}
				type="range"
				className={styles.slider}
				value={inputValue}
				min={inputMin}
				max={inputMax}
				step={inputStep}
				style={{ "--slider-progress": `${progress}%`, ...style }}
				onChange={handleChange}
				onMouseDown={() => setShowLabel(true)}
				onMouseUp={() => setShowLabel(false)}
				aria-label={ariaLabel}
				aria-valuetext={valueLabelFormat ? displayValue : undefined}
				list={!discreteMarks && marks ? "slider-marks" : undefined}
				{...props}
			/>
			{discreteMarks ? (
				<div className={styles.sliderMarks} aria-hidden="true">
					{discreteMarks.map((mark, index) => {
						const position =
							inputMax === inputMin
								? 0
								: ((mark.value - inputMin) / (inputMax - inputMin)) * 100;
						return (
							<span
								key={mark.value}
								className={clsx(
									styles.sliderMark,
									index <= selectedMarkIndex && styles.sliderMarkActive,
									index === selectedMarkIndex && styles.sliderMarkCurrent,
								)}
								style={{ left: `${position}%` }}
							>
								{mark.label && (
									<span className={styles.sliderMarkLabel}>{mark.label}</span>
								)}
							</span>
						);
					})}
				</div>
			) : marks ? (
				<datalist id="slider-marks">
					{marks.map((m) => (
						<option key={m.value} value={m.value} label={m.label} />
					))}
				</datalist>
			) : null}
			{valueLabelDisplay === "auto" && showLabel && (
				<div
					style={{
						position: "absolute",
						top: -28,
						left: `${((value - min) / (max - min)) * 100}%`,
						transform: "translateX(-50%)",
						fontSize: "0.75rem",
						background: "var(--neutral-800)",
						color: "white",
						padding: "2px 6px",
						borderRadius: 4,
					}}
				>
					{displayValue}
				</div>
			)}
		</div>
	);
}
