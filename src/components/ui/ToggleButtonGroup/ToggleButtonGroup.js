import clsx from "clsx";
import { Children, cloneElement } from "react";
import styles from "../shared.module.css";

export function ToggleButtonGroup({
	children,
	className,
	value,
	exclusive = false,
	onChange,
	...props
}) {
	const handleClick = (childValue) => (event) => {
		if (exclusive) {
			onChange?.(event, childValue);
		} else {
			onChange?.(event, childValue);
		}
	};

	return (
		<div
			className={clsx(styles.toggleGroup, className)}
			role="group"
			{...props}
		>
			{Children.map(children, (child) => {
				if (!child) return null;
				const childValue = child.props.value;
				return cloneElement(child, {
					selected: exclusive ? value === childValue : child.props.selected,
					onClick: (e) => {
						child.props.onClick?.(e);
						handleClick(childValue)(e);
					},
				});
			})}
		</div>
	);
}

export function ToggleButton({
	children,
	className,
	selected = false,
	value,
	onClick,
	...props
}) {
	return (
		<button
			type="button"
			className={clsx(
				styles.toggleButton,
				selected && styles.toggleButtonSelected,
				className,
			)}
			onClick={onClick}
			data-value={value}
			aria-pressed={selected}
			{...props}
		>
			{children}
		</button>
	);
}

export default ToggleButtonGroup;
