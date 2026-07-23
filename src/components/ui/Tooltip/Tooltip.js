import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../shared.module.css";
import { getAnchorRect, getTooltipPosition } from "./positioning";

const TOUCH_ENTER_DELAY = 1000;

function partitionProps(props) {
	const anchorProps = {};
	const tooltipProps = {};

	for (const [key, value] of Object.entries(props)) {
		if (key.startsWith("on") && typeof value === "function") {
			anchorProps[key] = value;
		} else {
			tooltipProps[key] = value;
		}
	}

	return { anchorProps, tooltipProps };
}

export default function Tooltip({
	title,
	children,
	arrow = true,
	placement = "top",
	enterDelay = 0,
	leaveDelay = 0,
	disableHoverListener = false,
	disableInteractive = false,
	...props
}) {
	const { anchorProps, tooltipProps } = partitionProps(props);
	const {
		onMouseEnter: onMouseEnterProp,
		onMouseLeave: onMouseLeaveProp,
		onFocus: onFocusProp,
		onBlur: onBlurProp,
		onTouchStart: onTouchStartProp,
		onTouchEnd: onTouchEndProp,
		onTouchCancel: onTouchCancelProp,
		onTouchMove: onTouchMoveProp,
		...otherAnchorProps
	} = anchorProps;
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const anchorRef = useRef(null);
	const tooltipRef = useRef(null);
	const enterTimerRef = useRef(null);
	const leaveTimerRef = useRef(null);
	const lastTouchStartRef = useRef(0);

	const isRecentTouch = () =>
		Date.now() - lastTouchStartRef.current < TOUCH_ENTER_DELAY;

	const clearTimers = () => {
		if (enterTimerRef.current) {
			clearTimeout(enterTimerRef.current);
			enterTimerRef.current = null;
		}
		if (leaveTimerRef.current) {
			clearTimeout(leaveTimerRef.current);
			leaveTimerRef.current = null;
		}
	};

	useEffect(() => () => clearTimers(), []);

	const show = (delay = enterDelay) => {
		clearTimers();
		if (delay > 0) {
			enterTimerRef.current = setTimeout(() => setOpen(true), delay);
		} else {
			setOpen(true);
		}
	};

	const hide = () => {
		clearTimers();
		if (leaveDelay > 0) {
			leaveTimerRef.current = setTimeout(() => setOpen(false), leaveDelay);
		} else {
			setOpen(false);
		}
	};

	const handleMouseEnter = () => {
		if (!disableHoverListener && !isRecentTouch()) {
			show();
		}
	};

	const handleMouseLeave = () => {
		if (!disableHoverListener) {
			hide();
		}
	};

	const handleTouchStart = () => {
		lastTouchStartRef.current = Date.now();
		show(TOUCH_ENTER_DELAY);
	};

	const handleTouchEnd = () => {
		hide();
	};

	useLayoutEffect(() => {
		if (!open || !anchorRef.current || !tooltipRef.current) return;

		const update = () => {
			if (!anchorRef.current || !tooltipRef.current) return;

			setPos(
				getTooltipPosition(
					getAnchorRect(anchorRef.current),
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
				onMouseEnter={(event) => {
					handleMouseEnter();
					onMouseEnterProp?.(event);
				}}
				onMouseLeave={(event) => {
					handleMouseLeave();
					onMouseLeaveProp?.(event);
				}}
				onFocus={(event) => {
					if (!isRecentTouch()) {
						show();
					}
					onFocusProp?.(event);
				}}
				onBlur={(event) => {
					hide();
					onBlurProp?.(event);
				}}
				onTouchStart={(event) => {
					handleTouchStart();
					onTouchStartProp?.(event);
				}}
				onTouchEnd={(event) => {
					handleTouchEnd();
					onTouchEndProp?.(event);
				}}
				onTouchCancel={(event) => {
					handleTouchEnd();
					onTouchCancelProp?.(event);
				}}
				onTouchMove={(event) => {
					handleTouchEnd();
					onTouchMoveProp?.(event);
				}}
				style={{ display: "inline-flex", maxWidth: "100%", minWidth: 0 }}
				{...otherAnchorProps}
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
							pointerEvents: disableInteractive ? "none" : undefined,
						}}
						{...tooltipProps}
					>
						{title}
					</div>,
					document.body,
				)}
		</>
	);
}
