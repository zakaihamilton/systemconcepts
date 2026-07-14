import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Box.module.css";

const Box = forwardRef(function Box(
	{ component: Component = "div", className, style, ...props },
	ref,
) {
	return (
		<Component
			ref={ref}
			className={clsx(styles.root, className)}
			style={style}
			{...props}
		/>
	);
});

export default Box;
