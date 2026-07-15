import clsx from "clsx";
import styles from "../shared.module.css";

export default function Alert({
	children,
	severity = "info",
	className,
	...props
}) {
	return (
		<div
			className={clsx(
				styles.alert,
				severity === "error" && styles.alertError,
				severity === "info" && styles.alertInfo,
				className,
			)}
			role="alert"
			{...props}
		>
			{children}
		</div>
	);
}
