import clsx from "clsx";
import styles from "./Divider.module.css";

export default function Divider({
	className,
	orientation = "horizontal",
	variant,
	style,
	...props
}) {
	return (
		<hr
			className={clsx(
				styles.root,
				orientation === "vertical" && styles.vertical,
				variant === "inset" && styles.inset,
				className,
			)}
			style={style}
			{...props}
		/>
	);
}
