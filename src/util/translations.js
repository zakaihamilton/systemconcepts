import { useMemo } from "react";
import languages from "@/data/languages";
import { useLanguage } from "@/util/language";

export function useTranslations() {
    const language = useLanguage();
    const items = useMemo(() => {
        const { translations } = languages.find(item => item.id === language) || {};
        const obj = {};
        (translations || []).map(({ id, value }) => {
            obj[id] = value;
        });
        return obj;
    }, [language]);
    return items;
}
