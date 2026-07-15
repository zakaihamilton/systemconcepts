export function getAnchorPosition(
	anchorEl,
	anchorOrigin = { vertical: "bottom", horizontal: "left" },
	transformOrigin = { vertical: "top", horizontal: "left" },
) {
	const rect = anchorEl.getBoundingClientRect();
	const style = { position: "fixed", zIndex: 1300 };

	if (anchorOrigin.vertical === "bottom") {
		style.top = rect.bottom + 4;
	} else if (anchorOrigin.vertical === "top") {
		style.top = rect.top - 4;
	} else {
		style.top = rect.top + rect.height / 2;
	}

	if (anchorOrigin.horizontal === "left") {
		style.left = rect.left;
	} else if (anchorOrigin.horizontal === "right") {
		style.left = rect.right;
	} else {
		style.left = rect.left + rect.width / 2;
	}

	if (transformOrigin.horizontal === "right") {
		style.transform = "translateX(-100%)";
	}
	if (transformOrigin.vertical === "bottom") {
		style.transform = (style.transform || "") + " translateY(-100%)";
	}

	return style;
}
