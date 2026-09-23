export function getTypeSection({ sectionIndex, path, translations }: any) {
	if (sectionIndex) {
		return { name: path || translations.NEW_TYPE };
	}
}
