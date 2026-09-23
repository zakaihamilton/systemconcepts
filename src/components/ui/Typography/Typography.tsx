import clsx from "clsx";
import {
	type CSSProperties,
	type ElementType,
	forwardRef,
	type HTMLAttributes,
	type ReactNode,
} from "react";
import styles from "./Typography.module.css";

const variantMap: Record<string, string> = {
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

type TypographyVariant = keyof typeof variantMap;
type TypographyColor =
	| "text.secondary"
	| "text.primary"
	| "error.main"
	| "primary"
	| "secondary"
	| "error"
	| "warning"
	| "inherit";
type TypographyProps = Omit<HTMLAttributes<HTMLElement>, "color"> & {
	children?: ReactNode;
	variant?: TypographyVariant;
	component?: ElementType;
	color?: TypographyColor | string;
	noWrap?: boolean;
	gutterBottom?: boolean;
	align?: CSSProperties["textAlign"];
	display?: CSSProperties["display"];
	fontWeight?: CSSProperties["fontWeight"];
	classes?: { root?: string };
};

const colorMap: Record<string, string> = {
	"text.secondary": "secondary",
	"text.primary": "root",
	"error.main": "error",
	primary: "root",
	secondary: "secondary",
	error: "error",
	inherit: "inherit",
};

const Typography = forwardRef<HTMLElement, TypographyProps>(function Typography(
	{
		children,
		className,
		variant = "body1",
		component,
		color,
		noWrap = false,
		gutterBottom = false,
		align,
		display,
		fontWeight,
		classes = {},
		style,
		...props
	}: any,
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
				classes.root,
				className,
			)}
			style={{
				...(align && { textAlign: align }),
				...(display && { display }),
				...(fontWeight && { fontWeight }),
				...style,
			}}
			{...props}
		>
			{children}
		</Component>
	);
});

export default Typography;
