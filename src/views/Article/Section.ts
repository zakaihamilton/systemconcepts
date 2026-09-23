export function getArticleSection({ sectionIndex, name, translations }: any) {
	if (sectionIndex) {
		return { name: name || translations.NEW_ARTICLE };
	}
}
