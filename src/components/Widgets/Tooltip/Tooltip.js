import { useToolbarTooltipPlacement } from "@components/Toolbar/ToolbarContext";
import MuiTooltip from "@ui/Tooltip";

export default function Tooltip({
	arrow = true,
	title,
	children,
	placement,
	...props
}) {
	if (!title) {
		return children;
	}

	const toolbarPlacement = useToolbarTooltipPlacement();
	const resolvedPlacement = placement ?? toolbarPlacement ?? "top";

	return (
		<MuiTooltip
			arrow={arrow}
			title={title}
			placement={resolvedPlacement}
			{...props}
		>
			{children}
		</MuiTooltip>
	);
}

export { Tooltip };
