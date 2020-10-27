import { useState, useEffect } from "react";
import languages from "@data/languages";
import { useLanguage } from "@util/language";

export function useLocale() {
    const language = useLanguage();
    const { locale } = languages.find(item => item.id === language) || {};
    return locale;
}

export function useDateFormatter(options, depends = []) {
    const locale = useLocale();
    const [dateObj, setDateObj] = useState(new Intl.DateTimeFormat(locale, options));
    useEffect(() => {
        setDateObj(new Intl.DateTimeFormat(locale, options));
    }, [locale, ...depends]);
    return dateObj;
}
