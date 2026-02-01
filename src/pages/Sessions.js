import { useEffect, useCallback, useMemo } from "react";
import Table from "@widgets/Table";
import { useTranslations } from "@util/translations";
import { addPath, toPath } from "@util/pages";
import { useSessions, SessionsStore } from "@util/sessions";
import FilterBar from "@pages/Sessions/FilterBar";
import Group from "@widgets/Group";
import styles from "./Sessions.module.scss";
import Label from "@widgets/Label";
import Row from "@widgets/Row";
import MovieIcon from "@mui/icons-material/Movie";
import Tooltip from "@mui/material/Tooltip";
import Image from "@widgets/Image";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import clsx from "clsx";
import { useLocalStorage } from "@util/store";
import { formatDuration } from "@util/string";
import { useDeviceType } from "@util/styles";
import StatusBar from "@widgets/StatusBar";
import Cookies from "js-cookie";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SessionIcon from "@widgets/SessionIcon";
import Chip from "@mui/material/Chip";
import { SyncActiveStore } from "@sync/syncState";
import { PlayerStore } from "@pages/Player";

export default function SessionsPage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isMobile = useDeviceType() === "phone";
    const translations = useTranslations();
    const [sessions, loading] = useSessions();
    const { viewMode, groupFilter, typeFilter, yearFilter, orderBy, order } = SessionsStore.useState();
    const { session } = PlayerStore.useState();
    useLocalStorage("SessionsStore", SessionsStore, ["viewMode", "scrollOffset"]);

    // Memoize dependencies to prevent unnecessary resets
    const resetScrollDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode], [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode]);
    const tableDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, translations, viewMode, session], [groupFilter, typeFilter, yearFilter, translations, viewMode, session]);
    const itemPath = item => {
        return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
    };

    const target = useCallback(item => {
        return "#" + toPath("sessions", itemPath(item));
    }, []);

    const gotoItem = useCallback(item => {
        addPath(itemPath(item));
    }, []);

    const columns = useMemo(() => [
        {
            id: "thumbnailWidget",
            title: translations.THUMBNAIL,
            viewModes: {
                "grid": {
                    className: styles.gridThumbnail
                }
            }
        },
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            padding: false,
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridName
                }
            }
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true,
            style: {
                justifyContent: "center"
            },
            columnProps: {
                style: {
                    width: "9em"
                }
            },
            viewModes: {
                ...((!isMobile || orderBy !== "duration") && { "list": null, "table": null }),
                "grid": {
                    className: styles.gridDate
                }
            }
        },
        {
            id: "type",
            title: translations.TYPE,
            sortable: "typeOrder",
            viewModes: {}
        },
        {
            id: "durationWidget",
            title: translations.DURATION,
            sortable: "duration",
            style: {
                justifyContent: "center"
            },
            columnProps: {
                style: {
                    width: "6em"
                }
            },
            viewModes: {
                ...((!isMobile || orderBy === "duration") && { "list": null, "table": null }),
                "grid": {
                    className: styles.gridDuration
                }
            }
        },
        {
            id: "groupWidget",
            title: translations.GROUP,
            sortable: "group",
            selected: () => groupFilter.length,
            onSelectable: item => typeof item.group !== "undefined",
            onClick: item => SessionsStore.update(s => {
                const group = typeof item.group !== "undefined" && item.group;
                if (s.groupFilter.includes(group)) {
                    s.groupFilter = s.groupFilter.filter(g => g !== group);
                }
                else {
                    s.groupFilter = [...s.groupFilter, group];
                }
                s.offset = 0;
            }),
            columnProps: {
                style: {
                    width: "7em"
                }
            },
            style: {
                justifyContent: "center"
            },
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridGroup,
                    selectedClassName: styles.gridGroupSelected
                }
            }
        },
        {
            id: "tagsWidget",
            title: translations.TAGS,
            searchable: "tagsString",
            sortable: false,
            visible: false
        }
    ].filter(Boolean), [translations, isMobile, orderBy, groupFilter]);

    const handleIconClick = useCallback((itemType) => {
        SessionsStore.update(s => {
            if (s.typeFilter.includes(itemType)) {
                s.typeFilter = s.typeFilter.filter(t => t !== itemType);
            }
            else {
                s.typeFilter = [...s.typeFilter, itemType];
            }
            s.offset = 0;
        });
    }, []);

    const mapper = useCallback(item => {
        if (!item) {
            return null;
        }

        const percentage = item.duration && (item.position / item.duration * 100);
        const isPlaying = session && session.group === item.group && session.date === item.date && session.name === item.name;

        return {
            // Identity & core data
            key: item.key,
            id: item.id,
            name: item.name,
            date: item.date,
            year: item.year,
            group: item.group,
            color: item.color,
            type: item.type,
            typeOrder: item.typeOrder,

            // Media properties
            thumbnail: item.thumbnail,
            video: item.video,
            ai: item.ai,
            duration: item.duration,
            position: item.position,
            percentage,

            // Pre-computed display values
            summary: item.summary,
            tags: item.tags || [],
            tagsString: (item.tags || []).join(" "),
            formattedDuration: item.type === "image"
                ? ""
                : (item.duration > 1
                    ? formatDuration(item.duration * 1000, true)
                    : translations.UNKNOWN),
            isPlaying
        };
    }, [translations, session]);

    const renderColumn = useCallback((columnId, item) => {
        switch (columnId) {
            case 'name':
            case 'nameWidget': {
                const style = {};

                const icon = (
                    <div
                        style={style}
                        className={clsx(styles.icon, typeFilter.length && styles.active)}
                        onClick={() => handleIconClick(item.type)}
                        id={item.type}
                    >
                        <SessionIcon type={item.type} />
                    </div>
                );

                const nameContentInner = (
                    <span className={clsx(styles.labelText, viewMode !== "table" && styles.singleLine)}>
                        {item.name}
                        <div className={clsx(styles.percentageContainer, item.percentage && styles.visible)}>
                            <div className={styles.percentage} style={{ width: item.percentage + "%" }} />
                        </div>
                    </span>
                );

                const nameContent = <Tooltip enterDelay={500} enterNextDelay={500} arrow title={item.name}>
                    <div className={styles.nameContainer}>
                        {nameContentInner}
                    </div>
                </Tooltip>;

                const href = target(item);
                return viewMode === "grid"
                    ? <Label className={clsx(styles.labelName, styles[viewMode])} icon={viewMode !== "grid" && icon} name={nameContent} />
                    : <Row href={href} onClick={() => gotoItem(item)} icons={icon}>{nameContent}</Row>;
            }

            case 'thumbnail':
            case 'thumbnailWidget': {
                const shouldShowImage = viewMode === "grid";
                const altIcon = (
                    <>
                        {item.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />}
                        {item.ai && (
                            <div className={clsx(styles.altIcon, styles.ai, item.video && styles.video)}>
                                <AutoAwesomeIcon />
                            </div>
                        )}
                    </>
                );

                return (
                    <Image
                        href={target(item)}
                        onClick={() => gotoItem(item)}
                        path={shouldShowImage ? item.thumbnail : null}
                        width={viewMode === "grid" ? null : "12em"}
                        height={viewMode === "grid" ? null : "9em"}
                        alt={altIcon}
                        loading="lazy"
                    />
                );
            }

            case 'group':
            case 'groupWidget':
                return <Group fill={viewMode === "grid"} name={item.group} color={item.color} />;

            case 'duration':
            case 'durationWidget':
                return item.formattedDuration;

            case 'tags':
            case 'tagsWidget':
                return item.tags.length ? (
                    <div className={styles.tags}>
                        {item.tags.map(tag => (
                            <Chip key={tag} label={tag} size="small" className={styles.tag} />
                        ))}
                    </div>
                ) : null;

            default:
                return item[columnId];
        }
    }, [viewMode, typeFilter, target, gotoItem, handleIconClick]);

    const filter = useCallback(item => {
        let { group, type, year, thumbnail } = item;
        let show = (!groupFilter.length || groupFilter.includes(group));
        if (typeFilter?.length) {
            const excluded = ["with_thumbnail", "without_thumbnail", "thumbnails_all",
                "with_summary", "without_summary", "summaries_all",
                "with_tags", "without_tags", "tags_all",
                "with_position", "without_position", "position_all",
                "with_duration", "without_duration", "duration_all",
                "with_english", "with_hebrew", "languages_all",
                "without_image", "images_all"];
            const types = typeFilter.filter(t => !excluded.includes(t));
            const withoutImage = typeFilter.includes("without_image");
            const withThumbnail = typeFilter.includes("with_thumbnail");
            const withoutThumbnail = typeFilter.includes("without_thumbnail");
            const withSummary = typeFilter.includes("with_summary");
            const withoutSummary = typeFilter.includes("without_summary");
            const withTags = typeFilter.includes("with_tags");
            const withoutTags = typeFilter.includes("without_tags");
            const withPosition = typeFilter.includes("with_position");
            const withoutPosition = typeFilter.includes("without_position");
            const withDuration = typeFilter.includes("with_duration");
            const withoutDuration = typeFilter.includes("without_duration");
            const withEnglish = typeFilter.includes("with_english");
            const withHebrew = typeFilter.includes("with_hebrew");

            const matchType = !types.length || types.includes(type);

            let matchImage = true;
            if (withoutImage && type === "image") {
                matchImage = false;
            }

            let matchThumbnail = true;
            if (withThumbnail && withoutThumbnail) {
                matchThumbnail = true;
            } else if (withThumbnail) {
                matchThumbnail = !!thumbnail;
            } else if (withoutThumbnail) {
                matchThumbnail = !thumbnail;
            }

            let matchSummary = true;
            const hasSummary = !!item.summary;
            if (withSummary && withoutSummary) {
                matchSummary = true;
            } else if (withSummary) {
                matchSummary = hasSummary;
            } else if (withoutSummary) {
                matchSummary = !hasSummary;
            }

            let matchTags = true;
            const hasTags = !!item.tags?.length;
            if (withTags && withoutTags) {
                matchTags = true;
            } else if (withTags) {
                matchTags = hasTags;
            } else if (withoutTags) {
                matchTags = !hasTags;
            }

            let matchPosition = true;
            const hasPosition = parseInt(item.position) > 1;
            if (withPosition && withoutPosition) {
                matchPosition = true;
            } else if (withPosition) {
                matchPosition = hasPosition;
            } else if (withoutPosition) {
                matchPosition = !hasPosition;
            }

            let matchDuration = true;
            const hasDuration = parseInt(item.duration) > 1;
            if (withDuration && withoutDuration) {
                matchDuration = true;
            } else if (withDuration) {
                matchDuration = hasDuration;
            } else if (withoutDuration) {
                matchDuration = !hasDuration;
            }

            const isHebrew = /[\u0590-\u05FF]/.test(item.name);
            let matchLanguage = true;
            if (withEnglish && withHebrew) {
                matchLanguage = true;
            } else if (withEnglish) {
                matchLanguage = !isHebrew;
            } else if (withHebrew) {
                matchLanguage = isHebrew;
            }

            show = show && matchType && matchImage && matchThumbnail && matchSummary && matchTags && matchPosition && matchDuration && matchLanguage;
        }
        if (yearFilter?.length) {
            show = show && yearFilter?.includes(year);
        }
        return show;
    }, [groupFilter, typeFilter, yearFilter]);

    const getSeparator = useCallback((item, prevItem, orderBy) => {
        if (orderBy === "date") {
            return item.date !== prevItem.date;
        }
        if (orderBy === "group") {
            return item.group !== prevItem.group;
        }
        if (orderBy === "typeOrder") {
            return item.type !== prevItem.type;
        }
        return false;
    }, []);

    const viewModes = useMemo(() => ({
        list: {
            className: isMobile ? styles.listPhoneItem : styles.listItem
        },
        table: null,
        grid: {
            className: styles.gridItem
        }
    }), [isMobile]);

    const statusBar = useMemo(() => <StatusBar store={SessionsStore} />, []);

    useEffect(() => {
        SessionsStore.update(s => {
            if (!isSignedIn) {
                s.mode = "signin";
                s.message = translations.REQUIRE_SIGNIN;
            }

            else {
                s.mode = "";
                s.message = "";
            }
        });
    }, [isSignedIn, translations]);

    // Watch for sync completion and reload sessions if needed
    const needsSessionReload = SyncActiveStore.useState(s => s.needsSessionReload);
    const syncBusy = SyncActiveStore.useState(s => s.busy);
    useEffect(() => {
        // Only reload after sync completes (not during)
        if (needsSessionReload && !syncBusy) {
            // Force session reload by clearing sessions and marking as not busy
            // This will trigger the useSessions hook to reload data
            SessionsStore.update(s => {
                s.sessions = null;
                s.busy = false;
            });
            // Clear the flag to acknowledge the reload
            SyncActiveStore.update(s => {
                s.needsSessionReload = false;
            });
        }
    }, [needsSessionReload, syncBusy]);

    return <>
        {!isMobile && <FilterBar />}
        <Table
            cellWidth={isMobile ? "11em" : "16em"}
            cellHeight={isMobile ? "12em" : "17em"}
            name="sessions"
            store={SessionsStore}
            columns={columns}
            data={sessions}
            loading={loading}
            statusBar={statusBar}
            mapper={mapper}
            filter={filter}
            viewModes={viewModes}
            depends={tableDeps}
            resetScrollDeps={resetScrollDeps}
            getSeparator={getSeparator}
            renderColumn={renderColumn}
            rowClassName={item => item.isPlaying ? styles.playing : null}
            emptyLabel={syncBusy ? translations.SYNCING + "..." : translations.NO_ITEMS}
        />

        {!!isMobile && <FilterBar />}
    </>;
}
