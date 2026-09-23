import clsx from "clsx";
import styles from "../shared.module.css";

export default function Badge({
	children,
	variant,
	invisible,
	className,
	...props
}: any) {
	return (
		<span className={clsx(styles.badge, className)} {...props}>
			{children}
			{variant === "dot" && !invisible && <span className={styles.badgeDot} />}
		</span>
	);
}
