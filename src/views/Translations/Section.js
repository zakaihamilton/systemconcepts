import languages from "@data/languages";

export function getTranslationsSection({ language: languageId }) {
    if (languageId) {
        const language = languageId && languages.find(item => item.id === languageId);
        return { name: language.name };
    }
}
