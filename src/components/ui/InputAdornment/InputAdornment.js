import clsx from "clsx";
import styles from "./InputAdornment.module.css";

export default function InputAdornment({
	children,
	position = "end",
	className,
}) {
	return (
		<span
			className={clsx(
				styles.root,
				position === "start" ? styles.positionStart : styles.positionEnd,
				className,
			)}
		>
			{children}
		</span>
	);
}
