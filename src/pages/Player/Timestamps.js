import { useEffect, useCallback, useState } from "react";
import Table from "@/widgets/Table";
import Label from "@/widgets/Label";
import StatusBar from "@/widgets/StatusBar";
import { Store } from "pullstate";
import Select from '@/components/Widgets/Select';
import ItemMenu from "./Timestamps/ItemMenu";
import { useTranslations } from "@/util/translations";
import { makePath, fileTitle, fileFolder } from "@/util/path";
import { useFile } from "@/util/storage";
import { useParentParams } from "@/util/pages";
import { formatDuration } from "@/util/string";
import { PlayerStore } from "../Player";
import Edit from "./Timestamps/Edit";
import styles from "./Timestamps.module.scss";
import { useLocalStorage } from "@/util/store";
import AccessTimeIcon from '@material-ui/icons/AccessTime';

export const TimestampsStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
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
    const [counter, setCounter] = useState(0);
    const { suffix } = useParentParams();
    const { prefix = "sessions", group = "", year = "", date = "", name } = useParentParams(1);
    let components = [prefix, group, year, date + " " + name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const folder = fileFolder(path);
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata/" + folder + "/" + sessionName + ".json";
    const [metadata, loading, , setMetadata] = useFile(metadataPath, [], data => {
        return data ? JSON.parse(data) : {};
    });
    const timestamps = metadata && metadata.timestamps || [];
    const { item: editedItem, mode, select, enableItemClick, viewMode } = TimestampsStore.useState();
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
            s.onValidate = async name => {
                return !!name;
            };
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

    const onTimestampClick = enableItemClick && timestampClick;

    const columns = [
        {
            id: "iconWidget",
            viewModes: {
                list: true
            }
        },
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            onSelectable: item => mode !== "rename",
            onClick: mode !== "rename" && enableItemClick && renameItem
        },
        {
            id: "timestampWidget",
            title: translations.TIMESTAMP,
            sortable: "id",
            icon: <AccessTimeIcon />,
            onSelectable: item => mode !== "rename",
            onClick: mode !== "rename" && onTimestampClick
        }
    ];

    const mapper = item => {
        const menuIcon = !select && <ItemMenu viewMode={viewMode} setMetadata={setMetadata} item={item} />;
        const selectIcon = select && <Select select={select} item={item} store={TimestampsStore} />;
        const timestamp = formatDuration(item.id * 1000, true);
        const iconWidget = select ? selectIcon : menuIcon;

        let nameWidget = <Label name={item.name || translations.UNNAMED} icon={viewMode === "table" && iconWidget} />;
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
            refresh={() => {
                TimestampsStore.update(s => {
                    s.counter++;
                });
            }}
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null
            }}
            loading={loading}
            mapper={mapper}
            statusBar={statusBar}
            depends={[mode, select, viewMode, metadata, counter, translations]}
            rowHeight="6em"
            itemHeight="4em"
        />
    </>;
}
