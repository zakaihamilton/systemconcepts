import { useMemo } from "react";
import translations from "@/data/translations";
import { MainStore } from "@/components/Main";
import languages from "@/data/languages";

export function useTranslations() {
    let { language } = MainStore.useState();
    if (language === "auto") {
        language = (languages.find(item => navigator.language.includes(item.code)) || languages[0]).id;
    }
    const items = useMemo(() => {
        const obj = {};
        (translations || []).filter(item => item.language === language).map(({ id, value }) => {
            obj[id] = value;
        });
        return obj;
    }, [language]);
    return items;
};
