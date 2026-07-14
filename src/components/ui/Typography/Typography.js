import clsx from "clsx";
import { forwardRef } from "react";
import styles from "./Typography.module.css";

const variantMap = {
	h1: "h1",
	h2: "h2",
	h3: "h3",
	h4: "h4",
	h5: "h5",
	h6: "h6",
	body1: "p",
	body2: "p",
	subtitle1: "h6",
	subtitle2: "h6",
	caption: "span",
	button: "span",
};

const colorMap = {
	"text.secondary": "secondary",
	"text.primary": "root",
	"error.main": "error",
	primary: "root",
	secondary: "secondary",
	error: "error",
	inherit: "inherit",
};

const Typography = forwardRef(function Typography(
	{
		children,
		className,
		variant = "body1",
		component,
		color,
		noWrap = false,
		gutterBottom = false,
		style,
		...props
	},
	ref,
) {
	const Component = component || variantMap[variant] || "span";
	const colorClass = color ? styles[colorMap[color] || color] : undefined;

	return (
		<Component
			ref={ref}
			className={clsx(
				styles.root,
				styles[variant],
				colorClass,
				noWrap && styles.noWrap,
				gutterBottom && styles.gutterBottom,
				className,
			)}
			style={style}
			{...props}
		>
			{children}
		</Component>
	);
});

export default Typography;
