import MuiTooltip from "@ui/Tooltip";

export default function Tooltip({ arrow = true, title, children, ...props }) {
	if (!title) {
		return children;
	}

	return (
		<MuiTooltip arrow={arrow} title={title} {...props}>
			{children}
		</MuiTooltip>
	);
}

export { Tooltip };
