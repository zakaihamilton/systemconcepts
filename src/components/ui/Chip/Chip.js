import clsx from "clsx";
import styles from "../shared.module.css";

export default function Chip({ label, className, ...props }) {
	return (
		<span className={clsx(styles.chip, className)} {...props}>
			{label}
		</span>
	);
}
