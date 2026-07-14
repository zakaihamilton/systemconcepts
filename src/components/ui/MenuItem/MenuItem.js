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
	underline,
	...props
}) {
	const classNames = clsx(
		styles.item,
		selected && styles.selected,
		disabled && styles.disabled,
		className,
	);

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
