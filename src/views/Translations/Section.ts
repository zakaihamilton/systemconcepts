import languages from "@data/languages";

export function getTranslationsSection({ language: languageId }: any) {
	if (languageId) {
		const language =
			languageId && languages.find((item) => item.id === languageId);
		return { name: language.name };
	}
}
