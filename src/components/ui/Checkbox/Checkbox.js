import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Checkbox.module.css";

const Checkbox = forwardRef(function Checkbox(
	{
		className,
		color = "primary",
		checked,
		onChange,
		disabled,
		classes = {},
		...props
	},
	ref,
) {
	return (
		<span className={clsx(styles.root, classes.root, className)}>
			<input
				ref={ref}
				type="checkbox"
				className={clsx(
					styles.input,
					color === "primary" && styles.colorPrimary,
				)}
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				{...props}
			/>
		</span>
	);
});

export default Checkbox;
