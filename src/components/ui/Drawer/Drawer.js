import clsx from "clsx";
import styles from "../shared.module.css";

export default function Drawer({
	open,
	onClose,
	anchor = "left",
	children,
	className,
	variant,
	ModalProps: _modalProps,
	PaperProps: _paperProps,
	SlideProps: _slideProps,
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
			{(open || variant === "persistent") && (
				<aside
					aria-hidden={!open}
					inert={!open}
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
			)}
		</>
	);
}
