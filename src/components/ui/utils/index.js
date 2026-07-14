import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAnchorPosition } from "./position";

export function Popper({
	open,
	anchorEl,
	children,
	placement,
	className,
	style,
}) {
	if (!open || !anchorEl) return null;

	const pos = getAnchorPosition(
		anchorEl,
		{ vertical: "bottom", horizontal: "left" },
		{ vertical: "top", horizontal: "left" },
	);

	return createPortal(
		<div className={className} style={{ ...pos, ...style }}>
			{children}
		</div>,
		document.body,
	);
}

export function ClickAwayListener({ children, onClickAway }) {
	const ref = useRef(null);

	useEffect(() => {
		const handleClick = (e) => {
			if (ref.current && !ref.current.contains(e.target)) {
				onClickAway?.(e);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClickAway]);

	return <div ref={ref}>{children}</div>;
}

export function NoSsr({ children }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;
	return children;
}

export function Fade({ in: inProp, children, timeout = 300 }) {
	return (
		<div
			style={{
				opacity: inProp ? 1 : 0,
				transition: `opacity ${timeout}ms ease`,
			}}
		>
			{children}
		</div>
	);
}

export function Collapse({
	in: inProp,
	children,
	timeout = 300,
	unmountOnExit,
}) {
	if (unmountOnExit && !inProp) {
		return null;
	}

	return (
		<div
			style={{
				maxHeight: inProp ? "1000px" : 0,
				opacity: inProp ? 1 : 0,
				overflow: "hidden",
				transition: `max-height ${timeout}ms ease, opacity ${timeout}ms ease`,
			}}
		>
			{children}
		</div>
	);
}

export function Zoom({ in: inProp, children, timeout = 300 }) {
	return (
		<div
			style={{
				transform: inProp ? "scale(1)" : "scale(0)",
				opacity: inProp ? 1 : 0,
				transition: `transform ${timeout}ms ease, opacity ${timeout}ms ease`,
			}}
		>
			{children}
		</div>
	);
}

export function Slide({
	in: inProp,
	children,
	direction = "up",
	timeout = 300,
}) {
	const transforms = {
		up: "translateY(100%)",
		down: "translateY(-100%)",
		left: "translateX(100%)",
		right: "translateX(-100%)",
	};
	return (
		<div
			style={{
				transform: inProp ? "none" : transforms[direction],
				transition: `transform ${timeout}ms ease`,
			}}
		>
			{children}
		</div>
	);
}

export function Grow({ in: inProp, children }) {
	return (
		<div
			style={{
				transform: inProp ? "scale(1)" : "scale(0.75)",
				opacity: inProp ? 1 : 0,
				transition: "transform 0.2s ease, opacity 0.2s ease",
			}}
		>
			{children}
		</div>
	);
}

export function MenuList({ children, className }) {
	return (
		<ul className={className} role="menu">
			{children}
		</ul>
	);
}

export const ButtonGroup = forwardRef(function ButtonGroup(
	{ children, className, ...props },
	ref,
) {
	return (
		<div
			ref={ref}
			className={className}
			style={{ display: "inline-flex" }}
			{...props}
		>
			{children}
		</div>
	);
});

export function CssBaseline() {
	return null;
}
