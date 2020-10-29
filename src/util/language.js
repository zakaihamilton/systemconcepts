import languages from "@data/languages";
import { MainStore } from "@components/Main";

export function useLanguage() {
    let { language } = MainStore.useState();
    if (language === "auto") {
        language = (typeof navigator !== "undefined" && languages.find(item => navigator.language.includes(item.code)) || languages[0]).id;
    }
    return language;
}
