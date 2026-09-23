export function getSessionSection({ date, name }: any) {
	const fullTitle = date + " " + name;
	return {
		label: fullTitle,
		tooltip: fullTitle,
	};
}
