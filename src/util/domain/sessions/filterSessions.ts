const EXCLUDED_TYPE_FILTERS = [
	"with_thumbnail",
	"without_thumbnail",
	"thumbnails_all",
	"with_summary",
	"without_summary",
	"summaries_all",
	"with_tags",
	"without_tags",
	"tags_all",
	"with_position",
	"without_position",
	"position_all",
	"with_english",
	"with_hebrew",
	"languages_all",
	"with_duration",
	"without_duration",
	"duration_all",
	"exclude_image_only",
];

function matchesToggleFilter(
	hasValue: boolean,
	withFlag: boolean,
	withoutFlag: boolean,
) {
	if (withFlag && !withoutFlag) {
		return hasValue;
	}
	if (withoutFlag && !withFlag) {
		return !hasValue;
	}
	return true;
}

export function filterSessionsList(
	sessions: any[] | null,
	{
		groupFilter,
		typeFilter,
		yearFilter,
	}: {
		groupFilter?: string[];
		typeFilter?: string[];
		yearFilter?: string[];
	},
) {
	if (!sessions) return [];

	let results = sessions;
	if (groupFilter?.length) {
		results = results.filter((session: any) =>
			groupFilter.includes(session.group),
		);
	}

	if (typeFilter?.length) {
		const types = typeFilter.filter((t) => !EXCLUDED_TYPE_FILTERS.includes(t));
		const excludeImageOnly = typeFilter.includes("exclude_image_only");
		const withThumbnail = typeFilter.includes("with_thumbnail");
		const withoutThumbnail = typeFilter.includes("without_thumbnail");
		const withSummary = typeFilter.includes("with_summary");
		const withoutSummary = typeFilter.includes("without_summary");
		const withTags = typeFilter.includes("with_tags");
		const withoutTags = typeFilter.includes("without_tags");
		const withPosition = typeFilter.includes("with_position");
		const withoutPosition = typeFilter.includes("without_position");
		const withEnglish = typeFilter.includes("with_english");
		const withHebrew = typeFilter.includes("with_hebrew");
		const withDuration = typeFilter.includes("with_duration");
		const withoutDuration = typeFilter.includes("without_duration");

		results = results.filter((session: any) => {
			if (excludeImageOnly && session.type === "image") {
				return false;
			}
			if (types.length && !types.includes(session.type)) {
				return false;
			}

			return (
				matchesToggleFilter(
					!!session.thumbnail,
					withThumbnail,
					withoutThumbnail,
				) &&
				matchesToggleFilter(!!session.summary, withSummary, withoutSummary) &&
				matchesToggleFilter(!!session.tags?.length, withTags, withoutTags) &&
				matchesToggleFilter(
					!!session.position,
					withPosition,
					withoutPosition,
				) &&
				matchesToggleFilter(
					!!session.hasDuration,
					withDuration,
					withoutDuration,
				) &&
				matchesToggleFilter(!!session.isHebrew, withHebrew, withEnglish)
			);
		});
	}

	if (yearFilter?.length) {
		results = results.filter((session: any) =>
			yearFilter.includes(session.year),
		);
	}

	return results;
}
