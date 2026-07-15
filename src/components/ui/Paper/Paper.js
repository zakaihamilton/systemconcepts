import clsx from "clsx";
import styles from "../shared.module.css";

export default function Paper({
	children,
	className,
	elevation = 1,
	rounded = true,
	...props
}) {
	return (
		<div
			className={clsx(
				styles.paperSurface,
				elevation === 1 && styles.elevation1,
				elevation === 2 && styles.elevation2,
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
