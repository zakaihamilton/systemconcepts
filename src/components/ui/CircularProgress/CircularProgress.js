import clsx from "clsx";
import styles from "./CircularProgress.module.css";

export default function CircularProgress({
	className,
	size = 40,
	thickness = 3.6,
	...props
}) {
	const radius = (size - thickness) / 2;
	const circumference = 2 * Math.PI * radius;

	return (
		<span
			className={clsx(styles.root, className)}
			role="progressbar"
			style={{ width: size, height: size }}
			{...props}
		>
			<svg className={styles.svg} viewBox={`0 0 ${size} ${size}`}>
				<circle
					className={styles.track}
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					strokeWidth={thickness}
				/>
				<circle
					className={styles.circle}
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					strokeWidth={thickness}
					style={{
						strokeDasharray: `${circumference * 0.25}px, ${circumference}px`,
					}}
				/>
			</svg>
		</span>
	);
}
