import clsx from "clsx";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "../shared.module.css";

const maxWidthMap: Record<string, number> = {
	xs: 444,
	sm: 600,
	md: 900,
	lg: 1200,
	xl: 1536,
};

export default function Dialog({
	open,
	onClose,
	children,
	className,
	fullScreen = false,
	fullWidth = false,
	maxWidth,
	minWidth,
	...props
}: any) {
	useEffect(() => {
		if (!open) return;
		const handleKey = (e: any) => {
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
				style={{
					...(fullWidth && { width: "100%" }),
					...(maxWidth != null && {
						maxWidth: maxWidthMap[maxWidth] ?? maxWidth,
					}),
					...(minWidth != null && { minWidth }),
				}}
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

export function DialogTitle({ children, className, style }: any) {
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
}: any) {
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

export function DialogActions({ children, className, style }: any) {
	return (
		<div className={clsx(styles.actions, className)} style={style}>
			{children}
		</div>
	);
}
