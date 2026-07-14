import clsx from "clsx";
import gridStyles from "./Grid.module.css";

function resolveBreakpoints(size, xs, sm, md) {
	if (size != null) {
		if (typeof size === "object") {
			return {
				xs: size.xs ?? xs,
				sm: size.sm ?? sm,
				md: size.md ?? md,
			};
		}
		return { xs: size, sm, md };
	}
	return { xs, sm, md };
}

function spanClassName(breakpoint, span) {
	if (!span) {
		return undefined;
	}
	return gridStyles[`span${breakpoint}${span}`];
}

export default function Grid({
	children,
	className,
	container,
	item,
	spacing = 2,
	size,
	xs,
	sm,
	md,
	style: styleProp,
	...props
}) {
	const breakpoints = resolveBreakpoints(size, xs, sm, md);
	const style = { ...styleProp };
	const classes = [className];

	if (container) {
		classes.push(gridStyles.container);
		style.gap = `${spacing * 8}px`;
		if (breakpoints.xs && breakpoints.xs !== 12) {
			style.gridTemplateColumns = `repeat(${12 / breakpoints.xs}, minmax(0, 1fr))`;
		}
	} else if (item || size != null || xs != null || sm != null || md != null) {
		classes.push(gridStyles.item);
		classes.push(
			spanClassName("Xs", breakpoints.xs),
			spanClassName("Sm", breakpoints.sm),
			spanClassName("Md", breakpoints.md),
		);
	}

	return (
		<div className={clsx(classes)} style={style} {...props}>
			{children}
		</div>
	);
}
