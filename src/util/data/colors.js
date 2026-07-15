export function hexToRgb(hex) {
	if (!hex) {
		return null;
	}
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			}
		: null;
}

function getLuminance(rgb) {
	const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color) {
	if (!color) return null;
	if (color.startsWith("#")) return hexToRgb(color);
	const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
	if (rgbMatch) {
		return {
			r: parseInt(rgbMatch[1], 10),
			g: parseInt(rgbMatch[2], 10),
			b: parseInt(rgbMatch[3], 10),
		};
	}
	return null;
}

export function getContrastRatio(color1, color2) {
	const rgb1 = parseColor(color1);
	const rgb2 = parseColor(color2);
	if (!rgb1 || !rgb2) return 1;

	const l1 = getLuminance(rgb1);
	const l2 = getLuminance(rgb2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

export function mixColors(color1, color2, weight) {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	if (!rgb1 || !rgb2) {
		return color1;
	}

	const r = Math.round(rgb1.r * weight + rgb2.r * (1 - weight));
	const g = Math.round(rgb1.g * weight + rgb2.g * (1 - weight));
	const b = Math.round(rgb1.b * weight + rgb2.b * (1 - weight));

	return `rgb(${r}, ${g}, ${b})`;
}

function getBackgroundColor() {
	if (typeof window === "undefined") return "#fafafa";
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue("--main-background")
			.trim() || "#fafafa"
	);
}

function getTextColor() {
	if (typeof window === "undefined") return "#18181b";
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-color")
			.trim() || "#18181b"
	);
}

export function useSessionTextColor(sessionColor) {
	const backgroundColor = getBackgroundColor();

	if (!sessionColor) {
		return getTextColor();
	}

	const effectiveBackgroundColor = mixColors(
		sessionColor,
		backgroundColor,
		0.3,
	);

	const contrastWhite = getContrastRatio(effectiveBackgroundColor, "#ffffff");
	const contrastBlack = getContrastRatio(effectiveBackgroundColor, "#000000");

	return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}

export function getSessionTextColor(sessionColor, theme) {
	const backgroundColor =
		theme?.palette?.background?.default || getBackgroundColor();

	if (!sessionColor) {
		return theme?.palette?.text?.primary || getTextColor();
	}

	const effectiveBackgroundColor = mixColors(
		sessionColor,
		backgroundColor,
		0.3,
	);

	const contrastWhite = getContrastRatio(effectiveBackgroundColor, "#ffffff");
	const contrastBlack = getContrastRatio(effectiveBackgroundColor, "#000000");

	return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}
