import clsx from "clsx";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
	variant?: "text" | "outlined" | "contained";
	color?: "primary" | "secondary" | "error" | "warning" | "inherit";
	size?: "small" | "medium" | "large";
	fullWidth?: boolean;
	startIcon?: ReactNode;
	endIcon?: ReactNode;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
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
	}: any,
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
