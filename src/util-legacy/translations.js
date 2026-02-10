import { useMemo } from "react";
import languages from "@data/languages";
import { useLanguage } from "@util-legacy/language";

export function useTranslations() {
    const language = useLanguage();
    const items = useMemo(() => {
        const { translations } = languages.find(item => item.id === language) || {};
        const obj = {};
        // Optimization: Use for...of instead of map to avoid creating unnecessary arrays
        for (const { id, value } of (translations || [])) {
            obj[id] = value;
        }
        return obj;
    }, [language]);
    return items;
}
