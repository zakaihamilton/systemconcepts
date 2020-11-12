import { useEffect, useCallback, useState } from "react";
import Table from "@widgets/Table";
import Row from "@widgets/Row";
import StatusBar from "@widgets/StatusBar";
import { Store } from "pullstate";
import ItemMenu from "./Timestamps/ItemMenu";
import { useTranslations } from "@util/translations";
import { makePath, fileTitle, fileFolder } from "@util/path";
import { useFile } from "@util/storage";
import { useParentParams, goBackPage } from "@util/pages";
import { formatDuration } from "@util/string";
import { PlayerStore } from "../Player";
import Edit from "./Timestamps/Edit";
import styles from "./Timestamps.module.scss";
import { useLocalStorage } from "@util/store";
import AccessTimeIcon from '@material-ui/icons/AccessTime';

export const TimestampsStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const TimestampsStore = new Store(TimestampsStoreDefaults);

export default function TimestampsPage() {
    const player = PlayerStore.useState(s => {
        return s.player;
    });
    const translations = useTranslations();
    const { suffix } = useParentParams();
    const { prefix = "sessions", group = "", year = "", date = "", name = "" } = useParentParams(1);
    let components = [prefix, group, year, date + " " + name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const folder = fileFolder(path);
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata/" + folder + "/" + sessionName + ".json";
    const { item: editedItem, mode, select, viewMode } = TimestampsStore.useState();
    const [metadata, loading, , setMetadata] = useFile(!!name && metadataPath, [name], data => {
        return data ? JSON.parse(data) : {};
    });
    const timestamps = metadata && metadata.timestamps || [];
    useLocalStorage("TimestampsStore", TimestampsStore, ["viewMode"]);

    useEffect(() => {
        TimestampsStore.update(s => {
            Object.assign(s, TimestampsStoreDefaults);
        });
    }, []);

    const timestampClick = useCallback(item => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            TimestampsStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        setMetadata(metadata => {
            metadata.position = id;
            return { ...metadata };
        });
        if (player) {
            player.currentTime = id;
        }
        goBackPage();
    }, [select]);

    const renameItem = useCallback(item => {
        TimestampsStore.update(s => {
            s.mode = "rename";
            s.type = item.type;
            s.name = item.name;
            s.item = item;
            s.icon = item.icon;
            s.tooltip = item.tooltip;
            s.placeholder = "";
            s.editing = true;
            s.onDone = async name => {
                setMetadata(metadata => {
                    const timestamps = [...metadata.timestamps].map(timestamp => {
                        timestamp = { ...timestamp };
                        if (timestamp.id === item.id) {
                            timestamp.name = name;
                        }
                        return timestamp;
                    });
                    return { ...metadata, timestamps };
                });
            }
        });
    }, []);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            padding: false
        },
        {
            id: "timestampWidget",
            title: translations.TIMESTAMP,
            sortable: "id",
            icon: <AccessTimeIcon />,
            onSelectable: () => mode !== "rename",
            onClick: mode !== "rename" && timestampClick
        }
    ];

    const mapper = item => {
        const timestamp = formatDuration(item.id * 1000, true);
        const iconWidget = <ItemMenu setMetadata={setMetadata} item={item} />;

        let nameWidget = <Row
            className={styles.row}
            fill={true}
            onClick={mode !== "rename" && renameItem.bind(this, item)}
            icons={iconWidget}>
            {item.name || translations.UNNAMED}
        </Row>;
        if (mode === "rename" && editedItem.id === item.id) {
            nameWidget = <Edit key={item.id} />;
        }

        return {
            ...item,
            nameWidget,
            iconWidget,
            timestampWidget: timestamp
        };
    };

    const statusBar = <StatusBar data={timestamps} mapper={mapper} store={TimestampsStore} />;

    const onImport = data => {
        Bookmarks.update(s => {
            s.timestamps = data.timestamps;
        });
    };

    return <>
        <Table
            name="timestamps"
            store={TimestampsStore}
            onImport={onImport}
            columns={columns}
            data={timestamps}
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null
            }}
            loading={loading}
            mapper={mapper}
            statusBar={statusBar}
            depends={[mode, select, editedItem, viewMode, metadata, translations]}
        />
    </>;
}
