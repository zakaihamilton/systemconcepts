import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../shared.module.css";

export default function Tooltip({
	title,
	children,
	arrow = true,
	placement = "top",
	...props
}) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const anchorRef = useRef(null);

	useEffect(() => {
		if (!open || !anchorRef.current) return;
		const rect = anchorRef.current.getBoundingClientRect();
		setPos({
			top: placement === "bottom" ? rect.bottom + 8 : rect.top - 32,
			left: rect.left + rect.width / 2,
		});
	}, [open, placement]);

	if (!title) return children;

	return (
		<>
			<span
				ref={anchorRef}
				onMouseEnter={() => setOpen(true)}
				onMouseLeave={() => setOpen(false)}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				style={{ display: "inline-flex" }}
			>
				{children}
			</span>
			{open &&
				createPortal(
					<div
						className={styles.tooltip}
						style={{
							top: pos.top,
							left: pos.left,
							transform: "translateX(-50%)",
						}}
						{...props}
					>
						{title}
					</div>,
					document.body,
				)}
		</>
	);
}
