import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Box.module.css";

const Box = forwardRef(function Box(
	{
		children,
		component: Component = "div",
		className,
		style,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		...props
	},
	ref,
) {
	return (
		<Component
			ref={ref}
			className={clsx(styles.root, className)}
			style={{
				...(minWidth != null && { minWidth }),
				...(minHeight != null && { minHeight }),
				...(maxWidth != null && { maxWidth }),
				...(maxHeight != null && { maxHeight }),
				...style,
			}}
			{...props}
		>
			{children}
		</Component>
	);
});

export default Box;
