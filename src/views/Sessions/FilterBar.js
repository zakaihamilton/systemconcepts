import { useTranslations } from "@util/translations";
import { SessionsStore } from "@util/sessions";
import { useMemo } from "react";
import MovieIcon from "@mui/icons-material/Movie";
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloseIcon from "@mui/icons-material/Close";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@widgets/Menu";
import styles from "./FilterBar.module.scss";
import clsx from "clsx";

export default function FilterBar({ hideYears = false }) {
    const translations = useTranslations();
    const { typeFilter, yearFilter, groupFilter, sessions, groups, showFilterDialog } = SessionsStore.useState();

    const types = useMemo(() => [
        {
            id: "category_header",
            name: translations.TYPES,
            header: true,
            highlight: ["audio", "video", "image", "overview", "ai"].some(id => typeFilter.includes(id)),
            expanded: ["audio", "video", "image", "overview", "ai"].some(id => typeFilter.includes(id)),
            items: [
                { id: "audio", name: translations.AUDIO, icon: <AudioIcon /> },
                { id: "video", name: translations.VIDEO, icon: <MovieIcon /> },
                { id: "image", name: translations.IMAGE, icon: <InsertPhotoOutlinedIcon /> },
                { id: "overview", name: translations.OVERVIEW, icon: <MovieFilterIcon /> },
                { id: "ai", name: translations.AI, icon: <AutoAwesomeIcon /> }
            ]
        },
        {
            id: "image_header",
            name: translations.EXCLUDE,
            header: true,
            highlight: typeFilter.includes("exclude_image_only"),
            expanded: typeFilter.includes("exclude_image_only"),
            items: [
                { id: "exclude_image_only", name: translations.EXCLUDE_IMAGE_ONLY }
            ]
        },
        {
            id: "thumbnail_header",
            name: translations.THUMBNAIL,
            header: true,
            highlight: typeFilter.includes("with_thumbnail") || typeFilter.includes("without_thumbnail"),
            expanded: typeFilter.includes("with_thumbnail") || typeFilter.includes("without_thumbnail"),
            items: [
                { id: "thumbnails_all", name: translations.ALL, radio: true },
                { id: "with_thumbnail", name: translations.WITH_THUMBNAIL, radio: true },
                { id: "without_thumbnail", name: translations.WITHOUT_THUMBNAIL, radio: true }
            ]
        },
        {
            id: "summary_header",
            name: translations.SUMMARY,
            header: true,
            highlight: typeFilter.includes("with_summary") || typeFilter.includes("without_summary"),
            expanded: typeFilter.includes("with_summary") || typeFilter.includes("without_summary"),
            items: [
                { id: "summaries_all", name: translations.ALL, radio: true },
                { id: "with_summary", name: translations.WITH_SUMMARY, radio: true },
                { id: "without_summary", name: translations.WITHOUT_SUMMARY, radio: true }
            ]
        },
        {
            id: "tags_header",
            name: translations.TAGS,
            header: true,
            highlight: typeFilter.includes("with_tags") || typeFilter.includes("without_tags"),
            expanded: typeFilter.includes("with_tags") || typeFilter.includes("without_tags"),
            items: [
                { id: "tags_all", name: translations.ALL, radio: true },
                { id: "with_tags", name: translations.WITH_TAGS, radio: true },
                { id: "without_tags", name: translations.WITHOUT_TAGS, radio: true }
            ]
        },
        {
            "id": "duration_header",
            "name": translations.DURATION,
            "header": true,
            highlight: typeFilter.includes("with_duration") || typeFilter.includes("without_duration"),
            "expanded": typeFilter.includes("with_duration") || typeFilter.includes("without_duration"),
            items: [
                { id: "duration_all", name: translations.ALL, radio: true },
                { id: "with_duration", name: translations.WITH_DURATION, radio: true },
                { id: "without_duration", name: translations.WITHOUT_DURATION, radio: true }
            ]
        },
        {
            id: "position_header",
            name: translations.POSITION,
            header: true,
            highlight: typeFilter.includes("with_position") || typeFilter.includes("without_position"),
            expanded: typeFilter.includes("with_position") || typeFilter.includes("without_position"),
            items: [
                { id: "position_all", name: translations.ALL, radio: true },
                { id: "with_position", name: translations.WITH_POSITION, radio: true },
                { id: "without_position", name: translations.WITHOUT_POSITION, radio: true }
            ]
        },
        {
            id: "language_header",
            name: translations.LANGUAGE,
            header: true,
            highlight: typeFilter.includes("with_english") || typeFilter.includes("with_hebrew"),
            expanded: typeFilter.includes("with_english") || typeFilter.includes("with_hebrew"),
            items: [
                { id: "languages_all", name: translations.BOTH, radio: true },
                { id: "with_english", name: translations.ENGLISH, radio: true },
                { id: "with_hebrew", name: translations.HEBREW, radio: true }
            ]
        }
    ], [translations, typeFilter]);

    const years = useMemo(() => {
        return (sessions || [])?.reduce((years, session) => {
            if (session.year && !years.includes(session.year)) {
                years.push(session.year);
            }
            return years;
        }, [])?.sort((a, b) => b.localeCompare(a));
    }, [sessions]);

    const groupMenuItems = useMemo(() => {
        return (groups || []).map(group => {
            const capitalizedName = group.name[0].toUpperCase() + group.name.slice(1);
            const groupColor = group.color;
            return {
                id: group.name,
                name: capitalizedName,
                checked: groupFilter.includes(group.name),
                selected: groupFilter,
                background: groupColor,
                onClick: () => {
                    SessionsStore.update(s => {
                        if (s.groupFilter.includes(group.name)) {
                            s.groupFilter = s.groupFilter.filter(name => name !== group.name);
                        } else {
                            s.groupFilter = [...s.groupFilter, group.name];
                        }
                    });
                }
            };
        });
    }, [groups, groupFilter]);

    const typeMenuItems = useMemo(() => {
        const mapItems = (list, insideHeader = false) => {
            return (list || []).map(type => ({
                id: type.id,
                name: type.name,
                icon: type.icon,
                divider: type.divider,
                header: type.header,
                highlight: insideHeader ? false : (type.header ? (type.highlight || false) : undefined),
                radio: (type.id === "thumbnails_all" && !typeFilter.includes("with_thumbnail") && !typeFilter.includes("without_thumbnail")) ||
                    (type.id === "summaries_all" && !typeFilter.includes("with_summary") && !typeFilter.includes("without_summary")) ||
                    (type.id === "tags_all" && !typeFilter.includes("with_tags") && !typeFilter.includes("without_tags")) ||
                    (type.id === "position_all" && !typeFilter.includes("with_position") && !typeFilter.includes("without_position")) ||
                    (type.id === "duration_all" && !typeFilter.includes("with_duration") && !typeFilter.includes("without_duration")) ||
                    (type.id === "languages_all" && !typeFilter.includes("with_english") && !typeFilter.includes("with_hebrew")) ||
                    (type.radio && typeFilter.includes(type.id)),
                checked: !type.radio && typeFilter.includes(type.id),
                selected: typeFilter,
                items: mapItems(type.items, type.header || insideHeader),
                onClick: (event) => {
                    console.log(`[FilterBar] Trace: Clicked on ${type.id}`);
                    console.log(`[FilterBar] Click on type:`, type.id, `radio:`, type.radio);
                    if (type.onClick) {
                        type.onClick(event);
                        return;
                    }
                    SessionsStore.update(s => {
                        const allRadios = {
                            thumbnails_all: ["with_thumbnail", "without_thumbnail"],
                            summaries_all: ["with_summary", "without_summary"],
                            tags_all: ["with_tags", "without_tags"],
                            position_all: ["with_position", "without_position"],
                            duration_all: ["with_duration", "without_duration"],
                            languages_all: ["with_english", "with_hebrew"]
                        };
                        if (allRadios[type.id]) {
                            s.typeFilter = s.typeFilter.filter(t => !allRadios[type.id].includes(t));
                            return;
                        }
                        else if (type.radio) {
                            const otherRadios = {
                                with_thumbnail: "without_thumbnail",
                                without_thumbnail: "with_thumbnail",
                                with_summary: "without_summary",
                                without_summary: "with_summary",
                                with_tags: "without_tags",
                                without_tags: "with_tags",
                                with_position: "without_position",
                                without_position: "with_position",
                                with_duration: "without_duration",
                                without_duration: "with_duration",
                                with_english: "with_hebrew",
                                with_hebrew: "with_english"
                            };
                            const otherRadio = otherRadios[type.id];
                            s.typeFilter = s.typeFilter.filter(t => t !== otherRadio);
                            if (!s.typeFilter.includes(type.id)) {
                                s.typeFilter = [...s.typeFilter, type.id];
                            }
                        }
                        else if (!type.header) {
                            if (s.typeFilter.includes(type.id)) {
                                s.typeFilter = s.typeFilter.filter(t => t !== type.id);
                            } else {
                                s.typeFilter = [...s.typeFilter, type.id];
                            }
                        }
                    });
                }
            }));
        };
        return mapItems(types);
    }, [types, typeFilter]);

    const yearMenuItems = useMemo(() => {
        return years.map(year => ({
            id: year,
            name: year,
            checked: yearFilter.includes(year),
            selected: yearFilter,
            onClick: () => {
                SessionsStore.update(s => {
                    if (s.yearFilter.includes(year)) {
                        s.yearFilter = s.yearFilter.filter(y => y !== year);
                    } else {
                        s.yearFilter = [...s.yearFilter, year];
                    }
                });
            }
        }));
    }, [years, yearFilter]);

    const getTypeLabel = () => {
        if (typeFilter.length === 0) return translations.ATTRIBUTES;
        if (typeFilter.length === 1) {
            const findType = (list) => {
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
                sub: translations.ATTRIBUTE
            };
        }
        return {
            main: `${typeFilter.length} ${translations.SELECTED}`,
            sub: translations.ATTRIBUTES
        };
    };

    const getYearLabel = () => {
        if (yearFilter.length === 0) return translations.YEARS;
        if (yearFilter.length === 1) {
            return {
                main: yearFilter[0],
                sub: translations.YEAR
            };
        }
        return {
            main: `${yearFilter.length} ${translations.SELECTED}`,
            sub: translations.YEARS
        };
    };

    const getGroupLabel = () => {
        if (groupFilter.length === 0) return translations.GROUPS;
        if (groupFilter.length === 1) {
            const capitalizedName = groupFilter?.[0]?.[0]?.toUpperCase() + groupFilter?.[0]?.slice(1);
            return {
                main: capitalizedName,
                sub: translations.GROUP
            };
        }
        return {
            main: `${groupFilter.length} ${translations.SELECTED}`,
            sub: translations.GROUPS
        };
    };

    const handleClearGroup = (e) => {
        e.stopPropagation();
        SessionsStore.update(s => {
            s.groupFilter = [];
        });
    };

    const handleClearType = (e) => {
        e.stopPropagation();
        SessionsStore.update(s => {
            s.typeFilter = [];
        });
    };

    const handleClearYear = (e) => {
        e.stopPropagation();
        SessionsStore.update(s => {
            s.yearFilter = [];
        });
    };

    return (
        <div className={clsx(styles.root, !showFilterDialog && styles.hide)}>
            <div className={styles.container}>
                {/* Type Filter Dropdown */}
                <Menu items={typeMenuItems} selected={typeFilter}>
                    <button className={clsx(styles.dropdownButton, typeFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <div className={styles.labelContent}>
                            {typeof getTypeLabel() === 'string' ? (
                                <span>{getTypeLabel()}</span>
                            ) : (
                                <>
                                    <span className={styles.mainLabel}>{getTypeLabel().main}</span>
                                    <span className={styles.subLabel}>{getTypeLabel().sub}</span>
                                </>
                            )}
                        </div>
                        {typeFilter.length > 0 && (
                            <Tooltip title={translations.CLEAR_FILTER}>
                                <span>
                                    <CloseIcon
                                        className={styles.clearIcon}
                                        onClick={handleClearType}
                                    />
                                </span>
                            </Tooltip>
                        )}
                    </button>
                </Menu>

                {/* Year Filter Dropdown */}
                {!hideYears && <Menu items={yearMenuItems} selected={yearFilter}>
                    <button className={clsx(styles.dropdownButton, yearFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <div className={styles.labelContent}>
                            {typeof getYearLabel() === 'string' ? (
                                <span>{getYearLabel()}</span>
                            ) : (
                                <>
                                    <span className={styles.mainLabel}>{getYearLabel().main}</span>
                                    <span className={styles.subLabel}>{getYearLabel().sub}</span>
                                </>
                            )}
                        </div>
                        {yearFilter.length > 0 && (
                            <Tooltip title={translations.CLEAR_FILTER}>
                                <span>
                                    <CloseIcon
                                        className={styles.clearIcon}
                                        onClick={handleClearYear}
                                    />
                                </span>
                            </Tooltip>
                        )}
                    </button>
                </Menu>}

                {/* Groups Filter Dropdown */}
                <Menu items={groupMenuItems} selected={groupFilter}>
                    <button className={clsx(styles.dropdownButton, groupFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <div className={styles.labelContent}>
                            {typeof getGroupLabel() === 'string' ? (
                                <span>{getGroupLabel()}</span>
                            ) : (
                                <>
                                    <span className={styles.mainLabel}>{getGroupLabel().main}</span>
                                    <span className={styles.subLabel}>{getGroupLabel().sub}</span>
                                </>
                            )}
                        </div>
                        {groupFilter.length > 0 && (
                            <Tooltip title={translations.CLEAR_FILTER}>
                                <span>
                                    <CloseIcon
                                        className={styles.clearIcon}
                                        onClick={handleClearGroup}
                                    />
                                </span>
                            </Tooltip>
                        )}
                    </button>
                </Menu>
            </div>
        </div>
    );
}
