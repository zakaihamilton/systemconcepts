import clsx from "clsx";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "../shared.module.css";

export default function Dialog({
	open,
	onClose,
	children,
	className,
	fullScreen = false,
	maxWidth,
	...props
}) {
	useEffect(() => {
		if (!open) return;
		const handleKey = (e) => {
			if (e.key === "Escape") onClose?.(e);
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;

	return createPortal(
		<div className={styles.overlay} onClick={onClose} {...props}>
			<div
				className={clsx(
					styles.paper,
					fullScreen && styles.fullScreen,
					className,
				)}
				style={maxWidth ? { maxWidth } : undefined}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}

export function DialogTitle({ children, className, style }) {
	return (
		<div className={clsx(styles.title, className)} style={style}>
			{children}
		</div>
	);
}

export function DialogContent({
	children,
	className,
	dividers,
	style,
	...props
}) {
	return (
		<div
			className={clsx(
				styles.content,
				dividers && styles.contentDividers,
				className,
			)}
			style={style}
			{...props}
		>
			{children}
		</div>
	);
}

export function DialogActions({ children, className, style }) {
	return (
		<div className={clsx(styles.actions, className)} style={style}>
			{children}
		</div>
	);
}
