import {
	type CSSProperties,
	forwardRef,
	type HTMLAttributes,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { getAnchorPosition } from "./position";

type PopperProps = {
	open: boolean;
	anchorEl: Element | null;
	children?: ReactNode;
	placement?: string;
	className?: string;
	style?: CSSProperties;
};

export function Popper({
	open,
	anchorEl,
	children,
	placement,
	className,
	style,
}: PopperProps) {
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

export function ClickAwayListener({
	children,
	onClickAway,
	className,
	mouseEvent: _mouseEvent,
}: {
	children?: ReactNode;
	onClickAway?: (event: MouseEvent) => void;
	className?: string;
	mouseEvent?: string;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				ref.current &&
				e.target instanceof Node &&
				!ref.current.contains(e.target)
			) {
				onClickAway?.(e);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClickAway]);

	return (
		<div ref={ref} className={className}>
			{children}
		</div>
	);
}

export function NoSsr({ children }: { children?: ReactNode }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;
	return children;
}

export function Fade({
	in: inProp,
	children,
	timeout = 300,
}: {
	in: boolean;
	children?: ReactNode;
	timeout?: number;
}) {
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
}: {
	in: boolean;
	children?: ReactNode;
	timeout?: number | "auto";
	unmountOnExit?: boolean;
}) {
	if (unmountOnExit && !inProp) {
		return null;
	}

	// When open, do not cap height or keep overflow:hidden — a fixed max-height
	// (e.g. 1000px) turns this into a scroll container that scrollIntoView can
	// advance, trapping users who cannot scroll overflow:hidden back up.
	const duration = typeof timeout === "number" ? timeout : 300;

	return (
		<div
			style={{
				maxHeight: inProp ? "none" : 0,
				opacity: inProp ? 1 : 0,
				overflow: inProp ? "visible" : "hidden",
				transition: `max-height ${duration}ms ease, opacity ${duration}ms ease`,
			}}
		>
			{children}
		</div>
	);
}

export function Zoom({
	in: inProp,
	children,
	timeout = 300,
}: {
	in: boolean;
	children?: ReactNode;
	timeout?: number;
}) {
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
}: {
	in: boolean;
	children?: ReactNode;
	direction?: "up" | "down" | "left" | "right";
	timeout?: number;
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

export function Grow({
	in: inProp,
	children,
}: {
	in: boolean;
	children?: ReactNode;
}) {
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

export function MenuList({
	children,
	className,
}: {
	children?: ReactNode;
	className?: string;
}) {
	return (
		<ul className={className} role="menu">
			{children}
		</ul>
	);
}

export const ButtonGroup = forwardRef<
	HTMLDivElement,
	HTMLAttributes<HTMLDivElement>
>(function ButtonGroup({ children, className, ...props }: any, ref) {
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
