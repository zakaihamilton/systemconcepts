import { useTranslations } from "@util/translations";
import { SessionsStore } from "@util/sessions";
import { useMemo, useRef } from "react";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloseIcon from "@mui/icons-material/Close";
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import HideImageIcon from '@mui/icons-material/HideImage';
import ListIcon from '@mui/icons-material/List';
import Tooltip from "@mui/material/Tooltip";
import Menu from "@widgets/Menu";
import styles from "./FilterBar.module.scss";
import clsx from "clsx";

export default function FilterBar({ hideYears = false }) {
    const translations = useTranslations();
    const { typeFilter, yearFilter, groupFilter, sessions, groups, groupsMetadata, showFilterDialog } = SessionsStore.useState();

    // Parse groups metadata
    const groupMetadata = useMemo(() => {
        try {
            return groupsMetadata ? JSON.parse(groupsMetadata) : [];
        } catch {
            return [];
        }
    }, [groupsMetadata]);

    const types = useMemo(() => [
        { id: "audio", name: translations.AUDIO, icon: <AudioIcon /> },
        { id: "video", name: translations.VIDEO, icon: <MovieIcon /> },
        { id: "image", name: translations.IMAGE, icon: <InsertPhotoOutlinedIcon /> },
        { id: "overview", name: translations.OVERVIEW, icon: <MovieFilterIcon /> },
        { id: "ai", name: translations.AI, icon: <AutoAwesomeIcon />, divider: true },
        {
            id: "thumbnail_header",
            name: translations.THUMBNAIL,
            header: true,
            expanded: typeFilter.includes("with_thumbnail") || typeFilter.includes("without_thumbnail"),
            items: [
                { id: "thumbnails_all", name: translations.THUMBNAILS_ALL, icon: <ListIcon />, radio: true },
                { id: "with_thumbnail", name: translations.WITH_THUMBNAIL, icon: <InsertPhotoIcon />, radio: true },
                { id: "without_thumbnail", name: translations.WITHOUT_THUMBNAIL, icon: <HideImageIcon />, radio: true }
            ]
        }
    ], [translations]);

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
            const metadata = (groupMetadata || []).find(item => item.name === group.name) || {};
            const capitalizedName = group.name[0].toUpperCase() + group.name.slice(1);
            return {
                id: group.name,
                name: capitalizedName,
                checked: groupFilter.includes(group.name),
                selected: groupFilter,
                backgroundColor: metadata.color,
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
    }, [groups, groupMetadata, groupFilter]);

    const typeMenuItems = useMemo(() => {
        const mapItems = (list) => {
            return (list || []).map(type => ({
                id: type.id,
                name: type.name,
                icon: type.icon,
                divider: type.divider,
                header: type.header,
                radio: type.id === "thumbnails_all" ? (!typeFilter.includes("with_thumbnail") && !typeFilter.includes("without_thumbnail")) : (type.radio && typeFilter.includes(type.id)),
                checked: !type.radio && typeFilter.includes(type.id),
                selected: typeFilter,
                items: mapItems(type.items),
                onClick: (event) => {
                    if (type.onClick) {
                        type.onClick(event);
                        return;
                    }
                    SessionsStore.update(s => {
                        if (type.id === "thumbnails_all") {
                            s.typeFilter = s.typeFilter.filter(t => t !== "with_thumbnail" && t !== "without_thumbnail");
                            return;
                        }
                        else if (type.radio) {
                            const otherRadio = type.id === "with_thumbnail" ? "without_thumbnail" : "with_thumbnail";
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
        if (typeFilter.length === 0) return translations.TYPES;
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
                sub: translations.TYPE
            };
        }
        return {
            main: `${typeFilter.length} ${translations.SELECTED}`,
            sub: translations.TYPES
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
