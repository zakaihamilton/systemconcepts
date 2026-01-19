import { useMemo } from "react";
import languages from "@data/languages";
import { useLanguage } from "@util/language";

export function useLocale() {
    const language = useLanguage();
    const { locale } = languages.find(item => item.id === language) || {};
    return locale;
}


// 1. Separate ordinal logic
const getOrdinal = (n, locale) => {
    if (!locale || !locale.startsWith("en")) {
        return n;
    }
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function useDateFormatter(options, locale) {
    const appLocale = useLocale();
    const effectiveLocale = locale || appLocale || 'en-US';
    const optionsString = JSON.stringify(options);
    // 2. Memoize the formatter object itself for performance
    const formatter = useMemo(() => {
        return new Intl.DateTimeFormat(effectiveLocale, JSON.parse(optionsString));
    }, [effectiveLocale, optionsString]);

    // 3. Return a formatting function that includes ordinal logic
    return {
        format: (date) => formatter.format(date),
        formatWithOrdinal: (date) => {
            const parts = formatter.formatToParts(date);
            return parts.map(part =>
                part.type === 'day' ? getOrdinal(parseInt(part.value), effectiveLocale) : part.value
            ).join('');
        }
    };
}
