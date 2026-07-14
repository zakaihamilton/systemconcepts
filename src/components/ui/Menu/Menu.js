import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
	style: styleProp,
	...props
}) {
	const menuRef = useRef(null);
	const [menuPosition, setMenuPosition] = useState(null);

	useLayoutEffect(() => {
		if (!open || !anchorEl || !menuRef.current) return;

		const updatePosition = () => {
			const menu = menuRef.current;
			if (!menu) return;

			const anchorRect = anchorEl.getBoundingClientRect();
			const width = menu.offsetWidth;
			const height = menu.offsetHeight;
			const margin = 8;
			const gap = 8;
			const maxLeft = Math.max(margin, window.innerWidth - width - margin);
			const maxTop = Math.max(margin, window.innerHeight - height - margin);

			let left =
				anchorOrigin.horizontal === "right"
					? anchorRect.right - width
					: anchorOrigin.horizontal === "center"
						? anchorRect.left + (anchorRect.width - width) / 2
						: anchorRect.left;
			let top =
				anchorOrigin.vertical === "top"
					? anchorRect.top - height - gap
					: anchorRect.bottom + gap;

			if (top + height > window.innerHeight - margin) {
				top = anchorRect.top - height - gap;
			}

			left = Math.min(Math.max(margin, left), maxLeft);
			top = Math.min(Math.max(margin, top), maxTop);

			setMenuPosition((previous) =>
				previous?.left === left && previous?.top === top
					? previous
					: { left, top },
			);
		};

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updatePosition);
		observer?.observe(menuRef.current);
		observer?.observe(anchorEl);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
			observer?.disconnect();
		};
	}, [
		open,
		anchorEl,
		anchorOrigin.horizontal,
		anchorOrigin.vertical,
	]);

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

	const style = {
		...getAnchorPosition(anchorEl, anchorOrigin, transformOrigin),
		...styleProp,
		...menuPosition,
	};

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
