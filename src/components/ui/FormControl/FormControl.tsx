import clsx from "clsx";
import styles from "../shared.module.css";

export default function FormControl({
	children,
	className,
	fullWidth,
	size: _size,
	style,
	...props
}: any) {
	return (
		<div
			className={clsx(styles.formControl, className)}
			style={{
				...(fullWidth ? { width: "100%" } : undefined),
				...style,
			}}
			{...props}
		>
			{children}
		</div>
	);
}

export function InputLabel({ children, className, ...props }: any) {
	return (
		<label className={clsx(styles.inputLabel, className)} {...props}>
			{children}
		</label>
	);
}

export function Select({
	children,
	value,
	onChange,
	className,
	label: _label,
	labelId,
	id,
	...props
}: any) {
	return (
		<select
			id={id}
			aria-labelledby={labelId}
			className={clsx(styles.select, className)}
			value={value}
			onChange={onChange}
			{...props}
		>
			{children}
		</select>
	);
}
