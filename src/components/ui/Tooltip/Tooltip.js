import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../shared.module.css";
import { getTooltipPosition } from "./positioning";

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
	const tooltipRef = useRef(null);

	useLayoutEffect(() => {
		if (!open || !anchorRef.current || !tooltipRef.current) return;

		const update = () => {
			if (!anchorRef.current || !tooltipRef.current) return;

			setPos(
				getTooltipPosition(
					anchorRef.current.getBoundingClientRect(),
					tooltipRef.current.getBoundingClientRect(),
					placement,
				),
			);
		};

		update();

		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [open, placement, title]);

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
						ref={tooltipRef}
						className={styles.tooltip}
						style={{
							top: pos.top,
							left: pos.left,
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
