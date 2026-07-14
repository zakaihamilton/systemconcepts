import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getAnchorPosition } from "../utils/position";
import styles from "./Menu.module.css";

export default function Menu({
	open,
	anchorEl,
	onClose,
	children,
	className,
	anchorOrigin = { vertical: "bottom", horizontal: "left" },
	transformOrigin = { vertical: "top", horizontal: "left" },
	...props
}) {
	const menuRef = useRef(null);

	useEffect(() => {
		if (!open) return;

		const handleClickOutside = (e) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target) &&
				anchorEl &&
				!anchorEl.contains(e.target)
			) {
				onClose?.(e);
			}
		};

		const handleKey = (e) => {
			if (e.key === "Escape") onClose?.(e);
		};

		const frame = window.setTimeout(() => {
			document.addEventListener("click", handleClickOutside, true);
			document.addEventListener("keydown", handleKey);
		}, 0);

		return () => {
			window.clearTimeout(frame);
			document.removeEventListener("click", handleClickOutside, true);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open, onClose, anchorEl]);

	if (!open || !anchorEl) return null;

	const style = getAnchorPosition(anchorEl, anchorOrigin, transformOrigin);

	return createPortal(
		<div
			ref={menuRef}
			className={className || styles.root}
			style={style}
			role="menu"
			{...props}
		>
			{children}
		</div>,
		document.body,
	);
}
