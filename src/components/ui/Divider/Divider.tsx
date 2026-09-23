import clsx from "clsx";
import type { CSSProperties, ElementType, HTMLAttributes } from "react";
import styles from "./Divider.module.css";

type DividerProps = Omit<HTMLAttributes<HTMLHRElement>, "color"> & {
	component?: ElementType;
	classes?: { root?: string };
	flexItem?: boolean;
	orientation?: "horizontal" | "vertical";
	variant?: "fullWidth" | "inset" | "middle";
	style?: CSSProperties;
};

export default function Divider({
	className,
	classes,
	component,
	flexItem: _flexItem,
	orientation = "horizontal",
	variant,
	style,
	...props
}: DividerProps) {
	const Component: any = component || "hr";
	return (
		<Component
			className={clsx(
				styles.root,
				orientation === "vertical" && styles.vertical,
				variant === "inset" && styles.inset,
				classes?.root,
				className,
			)}
			style={style}
			{...props}
		/>
	);
}
