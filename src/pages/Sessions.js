import React, { useEffect, useCallback, useMemo } from "react";
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

export default function SessionsPage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isPhone = useDeviceType() === "phone";
    const translations = useTranslations();
    const [sessions, loading] = useSessions();
    const { viewMode, groupFilter, typeFilter, yearFilter, orderBy, order, showFilterDialog } = SessionsStore.useState();
    useLocalStorage("SessionsStore", SessionsStore, ["viewMode", "scrollOffset"]);

    // Memoize dependencies to prevent unnecessary resets
    const resetScrollDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode], [groupFilter, typeFilter, yearFilter, orderBy, order, viewMode]);
    const tableDeps = useMemo(() => [groupFilter, typeFilter, yearFilter, translations, viewMode], [groupFilter, typeFilter, yearFilter, translations, viewMode]);
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
                    width: "7em"
                }
            },
            viewModes: {
                ...((!isPhone || orderBy !== "duration") && { "list": null, "table": null }),
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
                ...((!isPhone || orderBy === "duration") && { "list": null, "table": null }),
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
        }
    ].filter(Boolean), [translations, isPhone, orderBy, groupFilter]);

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
        const { position, duration } = item;
        const percentage = duration && (position / duration * 100);
        const style = {
            background: `conic-gradient(var(--primary-color) ${percentage}%, transparent 0)`
        };
        const title = translations[item.type.toUpperCase()];
        const onClickIcon = () => handleIconClick(item.type);

        const icon = <div style={style} className={styles.icon + " " + (typeFilter.length ? styles.active : "")} onClick={onClickIcon} id={item.type}>
            <SessionIcon type={item.type} />
        </div>;

        const altIcon = <>
            {item.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />}
            {!!item.ai && <div className={styles.altIcon + " " + styles.ai + " " + (item.video ? styles.video : "")}>
                <AutoAwesomeIcon />
            </div>}
        </>;

        const nameContent = <Tooltip arrow title={item.name}>
            <div className={clsx(styles.labelText, viewMode !== "table" && styles.singleLine)}>
                {item.name}
                <div className={styles.percentageContainer + " " + (percentage && styles.visible)}>
                    <div className={styles.percentage} style={{ width: percentage + "%" }} />
                </div>
            </div>
        </Tooltip>;

        const href = target(item);
        let nameWidget = <Row href={href} onClick={gotoItem.bind(null, item)} icons={icon}>{nameContent}</Row>;
        if (viewMode === "grid") {
            nameWidget = <Label className={clsx(styles.labelName, styles[viewMode])} icon={viewMode !== "grid" && icon} name={nameContent} />;
        }

        // Don't spread the entire item object - only add what's needed
        const durationWidget = item.type === "image" ? "" : (item.duration > 1 ? formatDuration(item.duration * 1000, true) : translations.UNKNOWN);

        // Return new object with only essential properties, not all file metadata
        return {
            // Core properties needed for display
            key: item.key,
            id: item.id,
            name: item.name,
            date: item.date,
            year: item.year,
            group: item.group,
            color: item.color,
            type: item.type,
            typeOrder: item.typeOrder,
            duration: item.duration,
            position: item.position,
            thumbnail: item.thumbnail,
            video: item.video,
            ai: item.ai,
            // Computed widgets
            nameWidget,
            groupWidget: <Group fill={viewMode === "grid"} name={item.group} color={item.color} />,
            thumbnailWidget: <Image href={href} onClick={gotoItem.bind(null, item)} clickForImage={false} path={item.thumbnail} width="15em" height="10em" alt={altIcon} />,
            durationWidget
        };
    }, [viewMode, typeFilter, translations, target, gotoItem, handleIconClick]);

    const filter = useCallback(item => {
        let { group, type, year } = item;
        let show = (!groupFilter.length || groupFilter.includes(group));
        if (typeFilter?.length) {
            show = show && typeFilter?.includes(type);
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
            className: isPhone ? styles.listPhoneItem : styles.listItem
        },
        table: null,
        grid: {
            className: styles.gridItem
        }
    }), [isPhone]);

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

    return <>
        {!!showFilterDialog && <FilterBar />}
        <Table
            cellWidth="16em"
            cellHeight="20em"
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
        />
    </>;
}
