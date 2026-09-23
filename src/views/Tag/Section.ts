export function getTagSection({ sectionIndex, path, translations }: any) {
	if (sectionIndex) {
		return { name: path || translations.NEW_TAG };
	}
}
