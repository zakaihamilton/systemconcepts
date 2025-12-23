import React, { useEffect } from "react";
import Table from "@widgets/Table";
import { useTranslations } from "@util/translations";
import { addPath, toPath } from "@util/pages";
import { useSessions } from "@util/sessions";
import { Store } from "pullstate";
import Group from "@widgets/Group";
import styles from "./Sessions.module.scss";
import Label from "@widgets/Label";
import Row from "@widgets/Row";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
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
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';

export const SessionsStore = new Store({
    groupFilter: "",
    typeFilter: "",
    order: "asc",
    orderBy: "date",
    viewMode: "list",
    scrollOffset: 0
});

export default function SessionsPage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isPhone = useDeviceType() === "phone";
    const translations = useTranslations();
    const [sessions, loading, askForFullSync] = useSessions();
    const { viewMode, groupFilter, typeFilter, orderBy } = SessionsStore.useState();
    useLocalStorage("SessionsStore", SessionsStore, ["viewMode"]);
    const itemPath = item => {
        return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
    };
    const target = item => {
        return "#" + toPath("sessions", itemPath(item));
    };
    const gotoItem = item => {
        addPath(itemPath(item));
    };

    const columns = [
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
            selected: () => groupFilter,
            onSelectable: item => typeof item.group !== "undefined",
            onClick: item => SessionsStore.update(s => {
                if (s.groupFilter) {
                    s.groupFilter = "";
                }
                else {
                    s.groupFilter = typeof item.group !== "undefined" && (item.group[0].toUpperCase() + item.group.slice(1));
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
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        const { position, duration } = item;
        const percentage = duration && (position / duration * 100);
        const style = {
            background: `conic-gradient(var(--primary-color) ${percentage}%, transparent 0)`
        };
        let title = translations[item.type.toUpperCase()];
        const onClickIcon = () => {
            SessionsStore.update(s => {
                if (s.typeFilter) {
                    s.typeFilter = "";
                }
                else {
                    s.typeFilter = item.type;
                }
                s.offset = 0;
            });
        };
        const icon = <Tooltip arrow title={title}>
            <div style={style} className={styles.icon + " " + (typeFilter ? styles.active : "")} onClick={onClickIcon} id={item.type}>
                {item.type === "video" && <MovieIcon />}
                {item.type === "audio" && <AudioIcon />}
                {item.type === "image" && <InsertPhotoOutlinedIcon />}
                {item.type === "overview" && <MovieFilterIcon />}
                {item.type === "ai" && <AutoAwesomeIcon />}
            </div>
        </Tooltip>;
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
        let nameWidget = <Row href={href} onClick={gotoItem.bind(this, item)} icons={icon}>{nameContent}</Row>;
        if (viewMode === "grid") {
            nameWidget = <Label className={clsx(styles.labelName, styles[viewMode])} icon={viewMode !== "grid" && icon} name={nameContent} />;
        }
        return {
            ...item,
            nameWidget,
            group: item.group,
            groupWidget: <Group fill={viewMode === "grid"} name={item.group} color={item.color} />,
            thumbnailWidget: <Image href={href} onClick={gotoItem.bind(this, item)} clickForImage={false} path={item.thumbnail} width="15em" height="10em" alt={altIcon} />,
            durationWidget: item.type === "image" ? "" : (item.duration > 1 ? formatDuration(item.duration * 1000, true) : translations.UNKNOWN)
        };
    };

    const filter = item => {
        let { group, type } = item;
        let show = (!groupFilter || groupFilter === (group[0].toUpperCase() + group.slice(1)));
        if (typeFilter?.length) {
            show = show && typeFilter?.includes(type);
        }
        return show;
    };

    const statusBar = <StatusBar store={SessionsStore} />;

    useEffect(() => {
        SessionsStore.update(s => {
            if (!isSignedIn) {
                s.mode = "signin";
                s.message = translations.REQUIRE_SIGNIN;
            }
            else if (askForFullSync) {
                s.mode = "sync";
                s.message = translations.REQUIRE_FULL_SYNC;
            }
            else {
                s.mode = "";
                s.message = "";
            }
        });
    }, [isSignedIn, askForFullSync, translations]);

    return <>
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
            viewModes={{
                list: {
                    className: isPhone ? styles.listPhoneItem : styles.listItem
                },
                table: null,
                grid: {
                    className: styles.gridItem
                }
            }}
            depends={[groupFilter, typeFilter, translations, viewMode]}
            resetScrollDeps={[groupFilter, typeFilter]}
            getSeparator={(item, prevItem, orderBy, viewMode) => {
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
            }}
        />
    </>;
}
