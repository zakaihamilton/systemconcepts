import React, { useEffect } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { addPath } from "@/util/pages";
import { useSync } from "@/util/sync";
import { useSessions } from "@/util/sessions";
import { Store } from "pullstate";
import Group from "@/widgets/Group";
import styles from "./Sessions.module.scss";
import Label from "@/widgets/Label";
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@/icons/Audio";
import Tooltip from '@material-ui/core/Tooltip';
import Image from "@/widgets/Image";
import GraphicEqIcon from '@material-ui/icons/GraphicEq';
import clsx from "clsx";
import { useLocalStorage } from "@/util/store";
import { formatDuration } from "@/util/string";
import { useDeviceType } from "@/util/styles";
import StatusBar from "@/widgets/StatusBar";
import Cookies from 'js-cookie';

export const SessionsStore = new Store({
    groupFilter: "",
    order: "asc",
    orderBy: "date",
    viewMode: "list"
});

export default function SessionsPage() {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isPhone = useDeviceType() === "phone";
    const translations = useTranslations();
    const [syncCounter] = useSync();
    const [sessions, loading] = useSessions([syncCounter]);
    const { viewMode, groupFilter } = SessionsStore.useState();
    useLocalStorage("SessionsStore", SessionsStore, ["viewMode"]);
    const gotoItem = item => {
        addPath(`session?&group=${item.group}&year=${item.year}&date=${item.date}&name=${item.name}`);
    };

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            onSelectable: () => true,
            onClick: gotoItem,
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridName
                }
            }
        },
        {
            id: "thumbnailWidget",
            onSelectable: () => true,
            title: translations.THUMBNAIL,
            onClick: gotoItem,
            viewModes: {
                "grid": {
                    className: styles.gridThumbnail
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
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridDate
                }
            }
        },
        {
            id: "durationWidget",
            title: translations.DURATION,
            sortable: "duration",
            style: {
                justifyContent: "center"
            },
            viewModes: {
                ...!isPhone && { "list": null },
                "table": null,
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
            style: {
                justifyContent: "center"
            },
            viewModes: {
                "list": null,
                "table": null,
                "grid": {
                    className: styles.gridGroup
                }
            }
        }
    ].filter(Boolean);

    const mapper = item => {
        if (!item) {
            return null;
        }
        const icon = <Tooltip arrow title={item.video ? translations.VIDEO : translations.AUDIO}>
            {item.video ? <MovieIcon /> : <AudioIcon />}
        </Tooltip>;
        const altIcon = item.video ? <MovieIcon fontSize="large" /> : <GraphicEqIcon fontSize="large" />;
        return {
            ...item,
            nameWidget: <Label className={clsx(styles.labelName, styles[viewMode])} icon={viewMode !== "grid" && icon} name={
                <Tooltip arrow title={item.name}>
                    <div className={clsx(styles.labelText, viewMode !== "table" && styles.singleLine)}>
                        {item.name}
                    </div>
                </Tooltip>
            } />,
            group: item.group,
            groupWidget: <Group name={item.group} color={item.color} />,
            thumbnailWidget: <Image clickForImage={false} path={item.thumbnail} width="13em" height="9em" alt={altIcon} />,
            durationWidget: item.duration ? formatDuration(item.duration * 1000, true) : translations.UNKNOWN
        };
    };

    const filter = item => {
        let { group } = item;
        let show = (!groupFilter || groupFilter === (group[0].toUpperCase() + group.slice(1)));
        return show;
    };

    const statusBar = <StatusBar store={SessionsStore} />;

    useEffect(() => {
        SessionsStore.update(s => {
            s.mode = !isSignedIn ? "signin" : "";
            s.message = !isSignedIn ? translations.REQUIRE_SIGNIN : "";
        });
    }, [isSignedIn, translations]);

    return <>
        <Table
            cellWidth="16em"
            cellHeight="14em"
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
            depends={[groupFilter, translations, viewMode]}
        />
    </>;
}
