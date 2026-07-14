import { forwardRef } from "react";

const iconColorMap = {
	primary: "var(--primary-color)",
	secondary: "var(--secondary-color)",
	error: "var(--error-color)",
	inherit: "inherit",
};

export function createIcon(children, displayName) {
	const Icon = forwardRef(function Icon(
		{ className, size = 24, style, color, ...props },
		ref,
	) {
		const colorStyle = color
			? { color: iconColorMap[color] || color }
			: undefined;

		return (
			<svg
				ref={ref}
				className={className}
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden={props["aria-label"] ? undefined : true}
				style={{ ...colorStyle, ...style }}
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
