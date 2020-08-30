import { useMemo } from "react";
import { useLanguage } from "@/util/language";
import terms from "@/data/terms";

export function useTerms() {
    const language = useLanguage();
    const items = useMemo(() => {
        const obj = {};
        terms.map(term => {
            term = { ...term };
            Object.keys(term).map(key => {
                const value = term[key];
                if (typeof value === "object") {
                    term[key] = value[language];
                }
            });
            obj[term.id] = term;
        });
        return obj;
    }, [language]);
    return items;
}
