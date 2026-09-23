import clsx from "clsx";
import { type AnchorHTMLAttributes, type ElementType, forwardRef } from "react";
import styles from "./Link.module.css";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color"> & {
	underline?: "none" | "hover" | "always";
	color?: "primary" | "secondary" | "inherit" | string;
	component?: ElementType;
	disabled?: boolean;
};

const Link = forwardRef<HTMLElement, LinkProps>(function Link(
	{
		children,
		className,
		href,
		underline = "hover",
		color = "primary",
		disabled = false,
		component: Component,
		...props
	}: any,
	ref,
) {
	const classNames = clsx(
		styles.root,
		underline === "always" && styles.underlineAlways,
		underline === "none" && styles.noUnderline,
		color === "inherit" && styles.inherit,
		Component === "button" && styles.button,
		className,
	);

	if (Component) {
		return (
			<Component ref={ref as never} className={classNames} {...props}>
				{children}
			</Component>
		);
	}

	return (
		<a
			ref={ref as React.Ref<HTMLAnchorElement>}
			{...props}
			href={disabled ? undefined : href}
			aria-disabled={disabled || undefined}
			tabIndex={disabled ? -1 : props.tabIndex}
			className={classNames}
		>
			{children}
		</a>
	);
});

export default Link;
