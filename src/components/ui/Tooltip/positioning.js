export const VIEWPORT_MARGIN = 8;
export const TOOLTIP_GAP = 8;

export function getTooltipBox(anchorRect, tooltipRect, placement) {
	const { width, height } = tooltipRect;

	switch (placement) {
		case "bottom":
			return {
				top: anchorRect.bottom + TOOLTIP_GAP,
				left: anchorRect.left + anchorRect.width / 2 - width / 2,
			};
		case "bottom-start":
			return {
				top: anchorRect.bottom + TOOLTIP_GAP,
				left: anchorRect.left,
			};
		case "left":
			return {
				top: anchorRect.top + anchorRect.height / 2 - height / 2,
				left: anchorRect.left - TOOLTIP_GAP - width,
			};
		case "right":
			return {
				top: anchorRect.top + anchorRect.height / 2 - height / 2,
				left: anchorRect.right + TOOLTIP_GAP,
			};
		case "top":
		default:
			return {
				top: anchorRect.top - TOOLTIP_GAP - height,
				left: anchorRect.left + anchorRect.width / 2 - width / 2,
			};
	}
}

export function clampToViewport({ top, left }, tooltipRect, viewport) {
	const { width, height } = tooltipRect;
	const maxLeft = viewport.width - width - VIEWPORT_MARGIN;
	const maxTop = viewport.height - height - VIEWPORT_MARGIN;

	return {
		top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop)),
		left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft)),
	};
}

export function getTooltipPosition(
	anchorRect,
	tooltipRect,
	placement,
	viewport = {
		width: window.innerWidth,
		height: window.innerHeight,
	},
) {
	return clampToViewport(
		getTooltipBox(anchorRect, tooltipRect, placement),
		tooltipRect,
		viewport,
	);
}

/**
 * Prefer a visible child box when the trigger wrapper collapses
 * (e.g. child is position:absolute and removed from flow).
 */
export function getAnchorRect(anchor) {
	const anchorRect = anchor.getBoundingClientRect();
	if (anchorRect.width > 0 || anchorRect.height > 0) {
		return anchorRect;
	}

	const child = anchor.firstElementChild;
	if (!child) {
		return anchorRect;
	}

	return child.getBoundingClientRect();
}
