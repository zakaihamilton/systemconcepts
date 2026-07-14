import clsx from "clsx";
import { Children, cloneElement } from "react";
import styles from "./Tabs.module.css";

export function Tabs({ children, value, onChange, className, ...props }) {
	return (
		<div className={clsx(styles.root, className)} role="tablist" {...props}>
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
