export function getImageSection({ label, translations }: any) {
	if (label) {
		return {
			label: translations[label],
		};
	}
	return {
		breadcrumbs: false,
	};
}
