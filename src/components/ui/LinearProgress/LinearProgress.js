import clsx from "clsx";
import styles from "./LinearProgress.module.css";

export default function LinearProgress({
	className,
	variant = "indeterminate",
	value = 0,
	...props
}) {
	const isDeterminate = variant === "determinate";

	return (
		<div
			className={clsx(
				styles.root,
				!isDeterminate && styles.indeterminate,
				className,
			)}
			role="progressbar"
			aria-valuenow={isDeterminate ? value : undefined}
			{...props}
		>
			<div
				className={styles.bar}
				style={
					isDeterminate ? { width: `${Math.min(100, value)}%` } : undefined
				}
			/>
		</div>
	);
}
