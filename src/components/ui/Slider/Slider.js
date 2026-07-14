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
	"aria-label": ariaLabel,
	...props
}) {
	const [showLabel, setShowLabel] = useState(false);
	const sliderRef = useRef(null);

	const handleChange = (e) => {
		const newValue = Number(e.target.value);
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
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={handleChange}
				onMouseDown={() => setShowLabel(true)}
				onMouseUp={() => setShowLabel(false)}
				aria-label={ariaLabel}
				list={marks ? "slider-marks" : undefined}
				{...props}
			/>
			{marks && (
				<datalist id="slider-marks">
					{marks.map((m) => (
						<option key={m.value} value={m.value} label={m.label} />
					))}
				</datalist>
			)}
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
