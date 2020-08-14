import { useMemo } from "react";
import languages from "@/data/languages";
import { MainStore } from "@/components/Main";

export function useTranslations() {
    let { language } = MainStore.useState();
    if (language === "auto") {
        language = (languages.find(item => navigator.language.includes(item.code)) || languages[0]).id;
    }
    const items = useMemo(() => {
        const { translations } = languages.find(item => item.id === language) || {};
        const obj = {};
        (translations || []).map(({ id, value }) => {
            obj[id] = value;
        });
        return obj;
    }, [language]);
    return items;
};
