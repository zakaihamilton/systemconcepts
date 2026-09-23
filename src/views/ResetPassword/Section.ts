export function getResetSection({ sectionIndex, translations }: any) {
	if (sectionIndex) {
		return {
			name: translations.CHANGE_PASSWORD,
			tooltip: translations.CHANGE_PASSWORD,
		};
	}
	return {};
}
