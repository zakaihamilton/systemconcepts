import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./List.module.css";

export function List({
	children,
	className,
	dense = false,
	disablePadding = false,
	component: Component = "ul",
	style,
	...props
}) {
	return (
		<Component
			className={clsx(
				styles.root,
				dense && styles.dense,
				disablePadding && styles.noPadding,
				className,
			)}
			style={style}
			{...props}
		>
			{children}
		</Component>
	);
}

export function ListItem({
	children,
	className,
	disablePadding,
	divider,
	style,
	...props
}) {
	return (
		<li
			className={clsx(
				styles.item,
				disablePadding && styles.noPadding,
				divider && styles.withDivider,
				className,
			)}
			style={style}
			{...props}
		>
			{children}
		</li>
	);
}

export const ListItemButton = forwardRef(function ListItemButton(
	{
		children,
		className,
		selected = false,
		onClick,
		component: Component,
		href,
		underline,
		color,
		style,
		...props
	},
	ref,
) {
	const classNames = clsx(
		styles.button,
		selected && styles.selected,
		className,
	);

	if (Component) {
		return (
			<Component
				ref={ref}
				className={classNames}
				onClick={onClick}
				href={href}
				underline={underline}
				color={color}
				style={style}
				{...props}
			>
				{children}
			</Component>
		);
	}

	return (
		<button
			ref={ref}
			type="button"
			className={classNames}
			onClick={onClick}
			style={style}
			{...props}
		>
			{children}
		</button>
	);
});

export function ListItemIcon({ children, className }) {
	return <span className={clsx(styles.icon, className)}>{children}</span>;
}

export function ListItemText({
	primary,
	secondary,
	className,
	primaryTypographyProps = {},
	secondaryTypographyProps = {},
	classes: classesProp = {},
}) {
	return (
		<div className={clsx(styles.text, className)}>
			{primary != null && (
				<span
					className={clsx(
						styles.primary,
						classesProp.primary,
						primaryTypographyProps.className,
					)}
					{...primaryTypographyProps}
				>
					{primary}
				</span>
			)}
			{secondary != null && (
				<span
					className={clsx(
						styles.secondary,
						classesProp.secondary,
						secondaryTypographyProps.className,
					)}
					{...secondaryTypographyProps}
				>
					{secondary}
				</span>
			)}
		</div>
	);
}

export function ListItemAvatar({ children, className }) {
	return <div className={clsx(styles.avatar, className)}>{children}</div>;
}

export function ListItemSecondaryAction({ children, className }) {
	return (
		<div className={clsx(styles.secondaryAction, className)}>{children}</div>
	);
}

export default List;
