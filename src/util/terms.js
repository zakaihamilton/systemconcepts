import { useMemo } from "react";
import { useLanguage } from "@/util/language";
import terms from "@/data/terms";
import { MainStore } from "@/components/Main";

export function useTerms() {
    const { darkMode } = MainStore.useState();
    const darkModeKey = darkMode ? "dark" : "light";
    const language = useLanguage();
    const items = useMemo(() => {
        const obj = {};
        terms.map(term => {
            term = { ...term };
            Object.keys(term).map(key => {
                const value = term[key];
                if (typeof value === "object") {
                    if ("dark" in value || "light" in value) {
                        term[key] = value[darkModeKey];
                    }
                    else {
                        term[key] = value[language];
                    }
                }
            });
            obj[term.id] = term;
        });
        return obj;
    }, [language]);
    return items;
}
