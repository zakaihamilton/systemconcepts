import { useWindowSize } from "@util/browser/size";
import { nextTrimmedString } from "@util/data/array";
import clsx from "clsx";

export function getProperty(name: any) {
	return getComputedStyle(document.documentElement, null).getPropertyValue(
		name,
	);
}

export function setProperty(name: any, value: any) {
	document.documentElement.style.setProperty(name, value);
}

export function toggleProperty(name: any, values: any) {
	const value = nextTrimmedString(values, name);
	setProperty(name, value);
	return value;
}

export function useStyles(styles: any, data: any) {
	const classList = [];
	// Optimization: Use for...of instead of map to avoid creating unnecessary arrays
	for (const key of Object.keys(data || {})) {
		let value = data[key];
		if (typeof value === "function") {
			value = value(data);
		}
		if (value) {
			classList.push(styles[key]);
		}
	}
	return clsx(...classList);
}

export function useDeviceType() {
	const size = useWindowSize();
	const isPhone = size.width && size.width <= 768;
	const isTablet = size.width && size.width >= 768 && size.width <= 1024;
	if (!size.width) {
		return "ssr";
	}
	if (isTablet) {
		return "tablet";
	}
	if (isPhone) {
		return "phone";
	}
	return "desktop";
}
