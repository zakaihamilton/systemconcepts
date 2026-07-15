import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./IconButton.module.css";

const IconButton = forwardRef(function IconButton(
	{
		children,
		className,
		size = "medium",
		edge = false,
		disabled = false,
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
				styles[size],
				edge === "end" && styles.edgeEnd,
				edge === "start" && styles.edgeStart,
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
});

export default IconButton;
