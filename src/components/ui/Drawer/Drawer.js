import clsx from "clsx";
import styles from "../shared.module.css";

export default function Drawer({
	open,
	onClose,
	anchor = "left",
	children,
	className,
	variant,
	...props
}) {
	return (
		<>
			{open && variant !== "persistent" && (
				<div
					className={styles.overlay}
					onClick={onClose}
					style={{ zIndex: 1199 }}
				/>
			)}
			<aside
				className={clsx(
					styles.drawer,
					anchor === "right" ? styles.drawerRight : styles.drawerLeft,
					!open && styles.drawerClosed,
					className,
				)}
				{...props}
			>
				{children}
			</aside>
		</>
	);
}
