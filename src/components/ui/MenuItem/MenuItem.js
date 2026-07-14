import clsx from "clsx";
import styles from "../Menu/Menu.module.css";

export default function MenuItem({
	children,
	className,
	selected = false,
	disabled = false,
	onClick,
	value,
	component: Component,
	href,
	underline: _underline,
	...props
}) {
	const classNames = clsx(
		styles.item,
		selected && styles.selected,
		disabled && styles.disabled,
		className,
	);

	const isSelectOption =
		value !== undefined && onClick == null && !Component && !href;

	if (isSelectOption) {
		return (
			<option
				value={value}
				disabled={disabled}
				className={className}
				{...props}
			>
				{children}
			</option>
		);
	}

	if (Component) {
		return (
			<Component
				role="menuitem"
				className={classNames}
				onClick={onClick}
				href={href}
				{...props}
			>
				{children}
			</Component>
		);
	}

	return (
		<button
			type="button"
			role="menuitem"
			className={classNames}
			disabled={disabled}
			onClick={onClick}
			data-value={value}
			{...props}
		>
			{children}
		</button>
	);
}
