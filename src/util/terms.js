import { useMemo } from "react";
import { useLanguage } from "@util/language";
import terms from "@data/terms";
import useDarkMode from "use-dark-mode";

export function useTerms() {
    const darkMode = useDarkMode(false);
    const darkModeKey = darkMode.value ? "dark" : "light";
    const language = useLanguage();
    const items = useMemo(() => {
        const obj = {};
        terms.map(object => {
            const term = { ...object, original: object };
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
