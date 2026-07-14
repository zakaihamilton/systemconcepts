import clsx from "clsx";
import styles from "../shared.module.css";

export default function Badge({
	children,
	variant,
	invisible,
	className,
	...props
}) {
	return (
		<span className={clsx(styles.badge, className)} {...props}>
			{children}
			{variant === "dot" && !invisible && <span className={styles.badgeDot} />}
		</span>
	);
}
