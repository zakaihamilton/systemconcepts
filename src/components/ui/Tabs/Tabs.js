import clsx from "clsx";
import {
	Children,
	cloneElement,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import styles from "./Tabs.module.css";

export function Tabs({ children, value, onChange, className, ...props }) {
	const rootRef = useRef(null);
	const [indicatorStyle, setIndicatorStyle] = useState(null);

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;
		let animationFrame;

		const updateIndicator = () => {
			const selectedTab = root.querySelector(
				'[role="tab"][aria-selected="true"]',
			);

			if (!selectedTab) {
				setIndicatorStyle(null);
				return;
			}

			setIndicatorStyle({
				transform: `translateX(${selectedTab.offsetLeft}px)`,
				width: `${selectedTab.offsetWidth}px`,
			});
		};

		const scheduleIndicatorUpdate = () => {
			cancelAnimationFrame(animationFrame);
			animationFrame = requestAnimationFrame(updateIndicator);
		};

		scheduleIndicatorUpdate();
		window.addEventListener("resize", scheduleIndicatorUpdate);

		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(scheduleIndicatorUpdate);
		resizeObserver?.observe(root);

		return () => {
			cancelAnimationFrame(animationFrame);
			window.removeEventListener("resize", scheduleIndicatorUpdate);
			resizeObserver?.disconnect();
		};
	}, [children, value]);

	return (
		<div
			ref={rootRef}
			className={clsx(styles.root, className)}
			role="tablist"
			{...props}
		>
			{Children.map(children, (child) => {
				if (!child) return null;
				return cloneElement(child, {
					selected: child.props.value === value,
					onClick: (e) => {
						child.props.onClick?.(e);
						onChange?.(e, child.props.value);
					},
				});
			})}
			{indicatorStyle && (
				<span
					aria-hidden="true"
					className={styles.indicator}
					style={indicatorStyle}
				/>
			)}
		</div>
	);
}

export function Tab({
	label,
	value,
	selected = false,
	disabled = false,
	onClick,
	className,
	icon,
	...props
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={selected}
			disabled={disabled}
			className={clsx(
				styles.tab,
				selected && styles.selected,
				disabled && styles.disabled,
				className,
			)}
			onClick={onClick}
			data-value={value}
			{...props}
		>
			{icon}
			{label}
		</button>
	);
}

export default Tabs;
