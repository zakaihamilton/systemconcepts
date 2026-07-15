import clsx from "clsx";
import styles from "../shared.module.css";

export default function Chip({ label, className, onDelete, ...props }) {
	return (
		<span className={clsx(styles.chip, className)} {...props}>
			{label}
			{onDelete && (
				<button
					type="button"
					className={styles.chipDelete}
					onClick={onDelete}
					aria-label={`Remove ${label}`}
				>
					×
				</button>
			)}
		</span>
	);
}
