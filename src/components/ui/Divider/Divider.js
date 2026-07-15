import clsx from "clsx";
import styles from "./Divider.module.css";

export default function Divider({
	className,
	classes,
	flexItem: _flexItem,
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
				classes?.root,
				className,
			)}
			style={style}
			{...props}
		/>
	);
}
