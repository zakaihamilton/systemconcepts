import { useMemo } from "react";
import languages from "@data/languages";
import { useLanguage } from "@util/language";

export function useLocale() {
    const language = useLanguage();
    const { locale } = languages.find(item => item.id === language) || {};
    return locale;
}

export function useDateFormatter(options, depends = []) {
    const locale = useLocale();
    const optionsString = JSON.stringify(options);
    const dateObj = useMemo(() => new Intl.DateTimeFormat(locale, options), [locale, optionsString, ...depends]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/use-memo
    return dateObj;
}
