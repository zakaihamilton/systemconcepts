import clsx from "clsx";
import styles from "./Table.module.css";

export function TableContainer({ children, className, ...props }) {
	return (
		<div className={clsx(styles.container, className)} {...props}>
			{children}
		</div>
	);
}

export function Table({ children, className, ...props }) {
	return (
		<table className={clsx(styles.table, className)} {...props}>
			{children}
		</table>
	);
}

export function TableHead({ children, className, ...props }) {
	return (
		<thead className={clsx(styles.head, className)} {...props}>
			{children}
		</thead>
	);
}

export function TableBody({ children, className, ...props }) {
	return (
		<tbody className={className} {...props}>
			{children}
		</tbody>
	);
}

export function TableRow({ children, className, selected, style, ...props }) {
	return (
		<tr
			className={clsx(styles.row, selected && styles.rowSelected, className)}
			style={style}
			data-selected={selected || undefined}
			{...props}
		>
			{children}
		</tr>
	);
}

export function TableCell({
	children,
	className,
	classes = {},
	component: Component = "td",
	stickyHeader = false,
	align,
	padding,
	...props
}) {
	const cellClassName = clsx(
		styles.cell,
		stickyHeader && styles.stickyHeader,
		align === "center" && styles.alignCenter,
		align === "right" && styles.alignRight,
		padding === "none" && styles.paddingNone,
		classes.root,
		className,
	);

	return (
		<Component className={cellClassName} {...props}>
			{children}
		</Component>
	);
}

export function TableSortLabel({
	children,
	active = false,
	direction = "asc",
	onClick,
	className,
}) {
	return (
		<button
			type="button"
			className={clsx(styles.sortLabel, active && styles.active, className)}
			onClick={onClick}
		>
			{children}
			{active && <span aria-hidden>{direction === "asc" ? "↑" : "↓"}</span>}
		</button>
	);
}

export default Table;
