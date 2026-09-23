import clsx from "clsx";
import { type ButtonHTMLAttributes, type ElementType, forwardRef } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = Omit<
	ButtonHTMLAttributes<HTMLButtonElement>,
	"color"
> & {
	size?: "small" | "medium" | "large";
	edge?: boolean | "start" | "end";
	component?: ElementType;
	href?: string;
	underline?: "none" | "hover" | "always";
	color?: string;
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	function IconButton(
		{
			children,
			className,
			size = "medium",
			edge = false,
			disabled = false,
			type = "button",
			component,
			...props
		}: any,
		ref,
	) {
		const Component: any = component || "button";
		return (
			<Component
				ref={ref}
				{...(component ? {} : { type })}
				disabled={disabled}
				className={clsx(
					styles.root,
					styles[size],
					edge === "end" && styles.edgeEnd,
					edge === "start" && styles.edgeStart,
					className,
				)}
				{...props}
			>
				{children}
			</Component>
		);
	},
);

export default IconButton;
