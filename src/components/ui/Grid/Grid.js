import clsx from "clsx";
import styles from "../shared.module.css";

export default function Grid({
	children,
	className,
	container,
	item,
	spacing = 2,
	xs,
	sm,
	md,
	...props
}) {
	const style = {};
	if (container) {
		style.display = "grid";
		style.gap = `${spacing * 8}px`;
		if (xs) style.gridTemplateColumns = `repeat(${12 / xs}, 1fr)`;
	}
	if (item && xs) {
		style.gridColumn = `span ${xs}`;
	}

	return (
		<div className={clsx(styles.grid, className)} style={style} {...props}>
			{children}
		</div>
	);
}
