import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Link.module.css";

const Link = forwardRef(function Link(
	{
		children,
		className,
		href,
		underline = "hover",
		color = "primary",
		component: Component,
		...props
	},
	ref,
) {
	const classNames = clsx(
		styles.root,
		underline === "always" && styles.underlineAlways,
		color === "inherit" && styles.inherit,
		Component === "button" && styles.button,
		className,
	);

	if (Component) {
		return (
			<Component ref={ref} className={classNames} {...props}>
				{children}
			</Component>
		);
	}

	return (
		<a ref={ref} href={href} className={classNames} {...props}>
			{children}
		</a>
	);
});

export default Link;
