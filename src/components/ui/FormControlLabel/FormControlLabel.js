import clsx from "clsx";
import styles from "./FormControlLabel.module.css";

export default function FormControlLabel({
	control,
	label,
	className,
	disabled = false,
	...props
}) {
	return (
		<label
			className={clsx(styles.root, disabled && styles.disabled, className)}
			{...props}
		>
			{control}
			{label && <span className={styles.label}>{label}</span>}
		</label>
	);
}
