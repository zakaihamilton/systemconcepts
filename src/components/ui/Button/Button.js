import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Button.module.css";

const Button = forwardRef(function Button(
	{
		children,
		className,
		variant = "text",
		color = "primary",
		size = "medium",
		disabled = false,
		fullWidth = false,
		startIcon,
		endIcon,
		type = "button",
		...props
	},
	ref,
) {
	return (
		<button
			ref={ref}
			type={type}
			disabled={disabled}
			className={clsx(
				styles.root,
				styles[variant],
				styles[color],
				styles[size],
				fullWidth && styles.fullWidth,
				className,
			)}
			{...props}
		>
			{startIcon && <span className={styles.startIcon}>{startIcon}</span>}
			{children}
			{endIcon && <span className={styles.endIcon}>{endIcon}</span>}
		</button>
	);
});

export default Button;
