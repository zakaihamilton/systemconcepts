import { useState, useEffect } from "react";
import languages from "@data/languages";
import { MainStore } from "@components/Main";

export function useLanguage() {
    const { language: storeLanguage } = MainStore.useState();
    const [clientLanguage, setClientLanguage] = useState(languages[0].id);

    useEffect(() => {
        if (typeof navigator !== "undefined") {
            const detected = (languages.find(item => navigator.language.includes(item.code)) || languages[0]).id;
            setTimeout(() => setClientLanguage(detected), 0);
        }
    }, []);

    if (storeLanguage === "auto") {
        return clientLanguage;
    }
    return storeLanguage;
}
