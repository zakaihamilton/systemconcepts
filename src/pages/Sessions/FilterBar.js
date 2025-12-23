import { useTranslations } from "@util/translations";
import { SessionsStore } from "@util/sessions";
import { useMemo } from "react";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloseIcon from "@mui/icons-material/Close";
import Menu from "@widgets/Menu";
import styles from "./FilterBar.module.scss";
import clsx from "clsx";

export default function FilterBar() {
    const translations = useTranslations();
    const { typeFilter, yearFilter, groupFilter, sessions, groups, groupsMetadata } = SessionsStore.useState();

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
        { id: "ai", name: translations.AI, icon: <AutoAwesomeIcon /> }
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
                icon: <GroupWorkIcon />,
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
        return types.map(type => ({
            id: type.id,
            name: type.name,
            icon: type.icon,
            checked: typeFilter.includes(type.id),
            selected: typeFilter,
            onClick: () => {
                SessionsStore.update(s => {
                    if (s.typeFilter.includes(type.id)) {
                        s.typeFilter = s.typeFilter.filter(t => t !== type.id);
                    } else {
                        s.typeFilter = [...s.typeFilter, type.id];
                    }
                });
            }
        }));
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
        if (typeFilter.length === 0) return translations.TYPE;
        if (typeFilter.length === 1) {
            const type = types.find(t => t.id === typeFilter[0]);
            return type?.name || typeFilter[0];
        }
        return `${typeFilter.length} ${translations.SELECTED}`;
    };

    const getYearLabel = () => {
        if (yearFilter.length === 0) return translations.YEARS;
        if (yearFilter.length === 1) return yearFilter[0];
        return `${yearFilter.length} ${translations.SELECTED}`;
    };

    const getGroupLabel = () => {
        if (groupFilter.length === 0) return translations.GROUPS;
        if (groupFilter.length === 1) {
            return groupFilter[0][0].toUpperCase() + groupFilter[0].slice(1);
        }
        return `${groupFilter.length} ${translations.SELECTED}`;
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
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.label}>{translations.FILTER}</div>

                {/* Groups Filter Dropdown */}
                <Menu items={groupMenuItems} selected={groupFilter}>
                    <button className={clsx(styles.dropdownButton, groupFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <span>{getGroupLabel()}</span>
                        {groupFilter.length > 0 && (
                            <CloseIcon
                                className={styles.clearIcon}
                                onClick={handleClearGroup}
                            />
                        )}
                    </button>
                </Menu>

                {/* Type Filter Dropdown */}
                <Menu items={typeMenuItems} selected={typeFilter}>
                    <button className={clsx(styles.dropdownButton, typeFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <span>{getTypeLabel()}</span>
                        {typeFilter.length > 0 && (
                            <CloseIcon
                                className={styles.clearIcon}
                                onClick={handleClearType}
                            />
                        )}
                    </button>
                </Menu>

                {/* Year Filter Dropdown */}
                <Menu items={yearMenuItems} selected={yearFilter}>
                    <button className={clsx(styles.dropdownButton, yearFilter.length > 0 && styles.active)}>
                        <ArrowDropDownIcon className={styles.arrow} />
                        <span>{getYearLabel()}</span>
                        {yearFilter.length > 0 && (
                            <CloseIcon
                                className={styles.clearIcon}
                                onClick={handleClearYear}
                            />
                        )}
                    </button>
                </Menu>
            </div>
        </div>
    );
}
