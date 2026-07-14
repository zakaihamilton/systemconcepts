import Link from "@ui/Link";
import { useDirection } from "@util/data/direction";
import clsx from "clsx";
import styles from "./Row.module.css";

export default function RowWidget({
	className,
	href,
	style,
	fill = true,
	basePadding = 8,
	iconPadding = 60,
	onClick,
	children,
	icons,
	...props
}) {
	const direction = useDirection();
	const paddingDirection = direction === "rtl" ? "paddingRight" : "paddingLeft";
	const backgroundStyle = {
		[paddingDirection]: basePadding + iconPadding + "px",
	};
	const contentStyle = { [paddingDirection]: basePadding + "px" };
	const isInteractive = Boolean(href || onClick);
	const backgroundClassName = clsx(
		styles.background,
		isInteractive && styles.clickable,
	);
	const content = isInteractive ? (
		<Link
			href={href}
			color="inherit"
			underline="none"
			className={backgroundClassName}
			style={backgroundStyle}
			onClick={onClick}
		>
			{children}
		</Link>
	) : (
		<div className={backgroundClassName} style={backgroundStyle}>
			{children}
		</div>
	);
	return (
		<div
			className={clsx(styles.root, fill && styles.fill, className)}
			style={style}
			{...props}
		>
			{content}
			<div className={styles.icons} style={contentStyle}>
				{icons}
			</div>
		</div>
	);
}
