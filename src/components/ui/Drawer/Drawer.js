import clsx from "clsx";
import styles from "../shared.module.css";

const ANCHOR_CLASS = {
	left: styles.drawerLeft,
	right: styles.drawerRight,
	top: styles.drawerTop,
	bottom: styles.drawerBottom,
};

export default function Drawer({
	open,
	onClose,
	anchor = "left",
	children,
	className,
	variant,
	style,
	ModalProps: _modalProps,
	PaperProps: _paperProps,
	SlideProps: _slideProps,
	...props
}) {
	const drawerZIndex = style?.zIndex ?? 1200;
	const overlayZIndex =
		typeof drawerZIndex === "number" ? drawerZIndex - 1 : 1199;

	return (
		<>
			{open && variant !== "persistent" && (
				<div
					className={styles.overlay}
					onClick={onClose}
					style={{ zIndex: overlayZIndex }}
				/>
			)}
			{(open || variant === "persistent") && (
				<aside
					aria-hidden={!open}
					inert={!open}
					className={clsx(
						styles.drawer,
						ANCHOR_CLASS[anchor] || styles.drawerLeft,
						!open && styles.drawerClosed,
						className,
					)}
					style={style}
					{...props}
				>
					{children}
				</aside>
			)}
		</>
	);
}
