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
                    else if ("eng" in value) {
                        term[key] = value[language];
                    }
                }
            });
            let id = term.id;
            if (term.type) {
                id = term.type + "." + id;
            }
            obj[id] = term;
        });
        return obj;
    }, [language, darkModeKey]);
    return items;
}
