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
import { useRecentHistory } from "@util/history";

export default function SessionsPage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isMobile = useDeviceType() === "phone";
    const translations = useTranslations();
    const [sessions, loading] = useSessions();
    const { viewMode, groupFilter, typeFilter, yearFilter, orderBy, order, showHistory } = SessionsStore.useState();
    const { session } = PlayerStore.useState();
    const [history] = useRecentHistory();
    useLocalStorage("SessionsStore", SessionsStore, ["viewMode", "scrollOffset", "showHistory"]);

    // Memoize dependencies to prevent unnecessary resets
    const resetScrollDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode, showHistory, history], [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode, showHistory, history]);
    const tableDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, translations, viewMode, session, showHistory, history], [groupFilter, typeFilter, yearFilter, translations, viewMode, session, showHistory, history]);
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
    ].filter(Boolean), [translations, isMobile, orderBy]);

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
                        className={styles.icon}
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
    }, [viewMode, target, gotoItem, handleIconClick]);



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
