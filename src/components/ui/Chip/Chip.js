import clsx from "clsx";
import styles from "../shared.module.css";

export default function Chip({
	label,
	className,
	onDelete,
	onClick,
	pressed,
	variant,
	...props
}) {
	const content = <span className={styles.chipLabel}>{label}</span>;
	if (onClick) {
		return (
			<button
				type="button"
				className={clsx(
					styles.chip,
					variant === "outlined" && styles.chipOutlined,
					variant === "filled" && styles.chipFilled,
					className,
				)}
				onClick={onClick}
				{...(typeof pressed === "boolean" ? { "aria-pressed": pressed } : {})}
				{...props}
			>
				{content}
			</button>
		);
	}

	return (
		<span className={clsx(styles.chip, className)} {...props}>
			{content}
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
