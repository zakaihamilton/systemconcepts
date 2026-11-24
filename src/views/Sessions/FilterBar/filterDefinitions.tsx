import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from "@icons/svg/AutoAwesome.svg";
import InsertPhotoOutlinedIcon from "@icons/svg/InsertPhotoOutlined.svg";
import MovieIcon from "@icons/svg/Movie.svg";
import MovieFilterIcon from "@icons/svg/MovieFilter.svg";
import { logger as structuredLogger } from "@util/api/logger";
import { SessionsStore } from "@util/domain/sessions";

export type FilterButtonLabel = string | { main: string; sub: string };

const ALL_RADIO_GROUPS: Record<string, [string, string]> = {
	thumbnails_all: ["with_thumbnail", "without_thumbnail"],
	summaries_all: ["with_summary", "without_summary"],
	tags_all: ["with_tags", "without_tags"],
	position_all: ["with_position", "without_position"],
	duration_all: ["with_duration", "without_duration"],
	languages_all: ["with_english", "with_hebrew"],
};

const OTHER_RADIO_MAP: Record<string, string> = Object.values(
	ALL_RADIO_GROUPS,
).reduce<Record<string, string>>((acc, [first, second]) => {
	acc[first] = second;
	acc[second] = first;
	return acc;
}, {});

function hasAny(filter: string[], ids: string[]): boolean {
	return ids.some((id) => filter.includes(id));
}

export function buildTypeDefinitions(translations: any, typeFilter: string[]) {
	const categoryIds = ["audio", "video", "image", "overview", "ai"];
	const categoryActive = hasAny(typeFilter, categoryIds);
	const excludeActive = typeFilter.includes("exclude_image_only");

	const radioGroup = (
		id: string,
		name: string,
		allId: string,
		allName: string,
		firstId: string,
		firstName: string,
		secondId: string,
		secondName: string,
	) => {
		const active = hasAny(typeFilter, [firstId, secondId]);
		return {
			id,
			name,
			header: true,
			highlight: active,
			expanded: active,
			items: [
				{ id: allId, name: allName, radio: true },
				{ id: firstId, name: firstName, radio: true },
				{ id: secondId, name: secondName, radio: true },
			],
		};
	};

	return [
		{
			id: "category_header",
			name: translations.TYPES,
			header: true,
			highlight: categoryActive,
			expanded: categoryActive,
			items: [
				{ id: "audio", name: translations.AUDIO, icon: <AudioIcon /> },
				{ id: "video", name: translations.VIDEO, icon: <MovieIcon /> },
				{
					id: "image",
					name: translations.IMAGE,
					icon: <InsertPhotoOutlinedIcon />,
				},
				{
					id: "overview",
					name: translations.OVERVIEW,
					icon: <MovieFilterIcon />,
				},
				{ id: "ai", name: translations.AI, icon: <AutoAwesomeIcon /> },
			],
		},
		{
			id: "image_header",
			name: translations.EXCLUDE,
			header: true,
			highlight: excludeActive,
			expanded: excludeActive,
			items: [
				{ id: "exclude_image_only", name: translations.EXCLUDE_IMAGE_ONLY },
			],
		},
		radioGroup(
			"thumbnail_header",
			translations.THUMBNAIL,
			"thumbnails_all",
			translations.ALL,
			"with_thumbnail",
			translations.WITH_THUMBNAIL,
			"without_thumbnail",
			translations.WITHOUT_THUMBNAIL,
		),
		radioGroup(
			"summary_header",
			translations.SUMMARY,
			"summaries_all",
			translations.ALL,
			"with_summary",
			translations.WITH_SUMMARY,
			"without_summary",
			translations.WITHOUT_SUMMARY,
		),
		radioGroup(
			"tags_header",
			translations.TAGS,
			"tags_all",
			translations.ALL,
			"with_tags",
			translations.WITH_TAGS,
			"without_tags",
			translations.WITHOUT_TAGS,
		),
		radioGroup(
			"duration_header",
			translations.DURATION,
			"duration_all",
			translations.ALL,
			"with_duration",
			translations.WITH_DURATION,
			"without_duration",
			translations.WITHOUT_DURATION,
		),
		radioGroup(
			"position_header",
			translations.POSITION,
			"position_all",
			translations.ALL,
			"with_position",
			translations.WITH_POSITION,
			"without_position",
			translations.WITHOUT_POSITION,
		),
		radioGroup(
			"language_header",
			translations.LANGUAGE,
			"languages_all",
			translations.BOTH,
			"with_english",
			translations.ENGLISH,
			"with_hebrew",
			translations.HEBREW,
		),
	];
}

export function buildTypeMenuItems(types: any[], typeFilter: string[]) {
	const mapItems = (list: any[], insideHeader = false): any[] => {
		return (list || []).map((type: any) => {
			const pair = ALL_RADIO_GROUPS[type.id];
			const isAllRadioSelected =
				Boolean(pair) && !hasAny(typeFilter, pair as string[]);
			return {
				id: type.id,
				name: type.name,
				icon: type.icon,
				divider: type.divider,
				header: type.header,
				highlight: insideHeader
					? false
					: type.header
						? type.highlight || false
						: undefined,
				radio:
					isAllRadioSelected || (type.radio && typeFilter.includes(type.id)),
				checked: !type.radio && typeFilter.includes(type.id),
				selected: typeFilter,
				items: mapItems(type.items, type.header || insideHeader),
				onClick: (event: any) => {
					structuredLogger.debug(`[FilterBar] Trace: Clicked on ${type.id}`);
					structuredLogger.debug(
						`[FilterBar] Click on type:`,
						type.id,
						`radio:`,
						type.radio,
					);
					if (type.onClick) {
						type.onClick(event);
						return;
					}
					SessionsStore.update((s) => {
						if (ALL_RADIO_GROUPS[type.id]) {
							s.typeFilter = s.typeFilter.filter(
								(t) => !ALL_RADIO_GROUPS[type.id].includes(t),
							);
							return;
						}
						if (type.radio) {
							const otherRadio = OTHER_RADIO_MAP[type.id];
							s.typeFilter = s.typeFilter.filter((t) => t !== otherRadio);
							if (!s.typeFilter.includes(type.id)) {
								s.typeFilter = [...s.typeFilter, type.id];
							}
						} else if (!type.header) {
							if (s.typeFilter.includes(type.id)) {
								s.typeFilter = s.typeFilter.filter((t) => t !== type.id);
							} else {
								s.typeFilter = [...s.typeFilter, type.id];
							}
						}
					});
				},
			};
		});
	};
	return mapItems(types);
}

export function buildGroupMenuItems(groups: any[], groupFilter: string[]) {
	return (groups || []).map((group) => {
		const capitalizedName = group.name[0].toUpperCase() + group.name.slice(1);
		return {
			id: group.name,
			name: capitalizedName,
			checked: groupFilter.includes(group.name),
			selected: groupFilter,
			background: group.color,
			onClick: () => {
				SessionsStore.update((s) => {
					if (s.groupFilter.includes(group.name)) {
						s.groupFilter = s.groupFilter.filter((name) => name !== group.name);
					} else {
						s.groupFilter = [...s.groupFilter, group.name];
					}
				});
			},
		};
	});
}

export function buildYearMenuItems(years: string[], yearFilter: string[]) {
	return years.map((year) => ({
		id: year,
		name: year,
		checked: yearFilter.includes(year),
		selected: yearFilter,
		onClick: () => {
			SessionsStore.update((s) => {
				if (s.yearFilter.includes(year)) {
					s.yearFilter = s.yearFilter.filter((y) => y !== year);
				} else {
					s.yearFilter = [...s.yearFilter, year];
				}
			});
		},
	}));
}

export function getTypeLabel(
	typeFilter: string[],
	types: any[],
	translations: any,
): FilterButtonLabel {
	if (typeFilter.length === 0) return translations.ATTRIBUTES;
	if (typeFilter.length === 1) {
		const findType = (list: any[]): any => {
			for (const item of list) {
				if (item.id === typeFilter[0]) return item;
				if (item.items) {
					const subItem = findType(item.items);
					if (subItem) return subItem;
				}
			}
			return null;
		};
		const type = findType(types);
		return {
			main: type?.name,
			sub: translations.ATTRIBUTE,
		};
	}
	return {
		main: `${typeFilter.length} ${translations.SELECTED}`,
		sub: translations.ATTRIBUTES,
	};
}

export function getYearLabel(
	yearFilter: string[],
	translations: any,
): FilterButtonLabel {
	if (yearFilter.length === 0) return translations.YEARS;
	if (yearFilter.length === 1) {
		return {
			main: yearFilter[0],
			sub: translations.YEAR,
		};
	}
	return {
		main: `${yearFilter.length} ${translations.SELECTED}`,
		sub: translations.YEARS,
	};
}

export function getGroupLabel(
	groupFilter: string[],
	translations: any,
): FilterButtonLabel {
	if (groupFilter.length === 0) return translations.GROUPS;
	if (groupFilter.length === 1) {
		const capitalizedName =
			groupFilter?.[0]?.[0]?.toUpperCase() + groupFilter?.[0]?.slice(1);
		return {
			main: capitalizedName,
			sub: translations.GROUP,
		};
	}
	return {
		main: `${groupFilter.length} ${translations.SELECTED}`,
		sub: translations.GROUPS,
	};
}
