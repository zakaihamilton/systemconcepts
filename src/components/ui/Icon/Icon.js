import { forwardRef } from "react";

const iconColorMap = {
	primary: "var(--primary-color)",
	secondary: "var(--secondary-color)",
	error: "var(--error-color)",
	warning: "var(--warning-color)",
	action: "var(--icon-color)",
	inherit: "inherit",
};

const fontSizeMap = {
	small: 20,
	medium: 24,
	large: 35,
};

function resolveIconProps({ size, color, fontSize, style }) {
	const resolvedSize =
		size ?? (fontSize ? fontSizeMap[fontSize] : undefined) ?? 24;
	const colorStyle = color
		? { color: iconColorMap[color] || color }
		: undefined;

	return {
		width: fontSize === "inherit" ? "1em" : resolvedSize,
		height: fontSize === "inherit" ? "1em" : resolvedSize,
		style: { ...colorStyle, ...style },
	};
}

export function withIcon(SvgComponent, displayName) {
	const Icon = forwardRef(function Icon(
		{ className, size, style, color, fontSize, ...props },
		ref,
	) {
		const {
			width,
			height,
			style: iconStyle,
		} = resolveIconProps({
			size,
			color,
			fontSize,
			style,
		});

		return (
			<SvgComponent
				ref={ref}
				className={className}
				width={width}
				height={height}
				aria-hidden={props["aria-label"] ? undefined : true}
				style={iconStyle}
				{...props}
			/>
		);
	});
	Icon.displayName = displayName;
	return Icon;
}

export function createIcon(children, displayName) {
	const Icon = forwardRef(function Icon(
		{ className, size, style, color, fontSize, ...props },
		ref,
	) {
		const {
			width,
			height,
			style: iconStyle,
		} = resolveIconProps({
			size,
			color,
			fontSize,
			style,
		});

		return (
			<svg
				ref={ref}
				className={className}
				width={width}
				height={height}
				viewBox="0 0 24 24"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden={props["aria-label"] ? undefined : true}
				style={iconStyle}
				{...props}
			>
				{children}
			</svg>
		);
	});
	Icon.displayName = displayName;
	return Icon;
}

export default createIcon;
