import { useMemo } from "react";
import translations from "@/data/translations";
import { MainStore } from "@/components/Main";

export function useTranslations() {
    const { language } = MainStore.useState();
    const items = useMemo(() => {
        const obj = {};
        (translations || []).filter(item => item.language === language).map(({ id, value }) => {
            obj[id] = value;
        });
        return obj;
    }, [language]);
    return items;
};
