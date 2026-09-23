import { useRegionalLocale } from "@util/domain/language";
import { useMemo } from "react";

export function useLocale() {
	return useRegionalLocale();
}

// 1. Separate ordinal logic
const getOrdinal = (n: any, locale: any) => {
	if (!locale || !locale.startsWith("en")) {
		return n;
	}
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function useDateFormatter(
	options: Intl.DateTimeFormatOptions,
	locale?: string,
) {
	const appLocale = useLocale();
	const effectiveLocale = locale || appLocale || "en-US";
	const optionsString = JSON.stringify(options);
	// 2. Memoize the formatter object itself for performance
	const formatter = useMemo(() => {
		return new Intl.DateTimeFormat(effectiveLocale, JSON.parse(optionsString));
	}, [effectiveLocale, optionsString]);

	// 3. Return a formatting function that includes ordinal logic
	return {
		format: (date: any) => {
			try {
				return formatter.format(date);
			} catch (_e: any) {
				return "";
			}
		},
		formatToParts: (date: any) => {
			try {
				return formatter.formatToParts(date);
			} catch (_e: any) {
				return [];
			}
		},
		formatWithOrdinal: (date: any) => {
			try {
				const parts = formatter.formatToParts(date);
				return parts
					.map((part) =>
						part.type === "day"
							? getOrdinal(parseInt(part.value), effectiveLocale)
							: part.value,
					)
					.join("");
			} catch (_e: any) {
				return "";
			}
		},
	};
}
