import { useState, useEffect } from "react";
import languages from "@data/languages";
import { MainStore } from "@components/Main";

export function useLanguage() {
    const { language: storeLanguage } = MainStore.useState();
    const [language, setLanguage] = useState(languages[0].id);

    useEffect(() => {
        if (storeLanguage === "auto") {
            const detected = (typeof navigator !== "undefined" && languages.find(item => navigator.language.includes(item.code)) || languages[0]).id;
            setLanguage(detected);
        } else {
            setLanguage(storeLanguage);
        }
    }, [storeLanguage]);

    return language;
}
