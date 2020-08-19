import { useCallback, useEffect } from "react";
import Table from "@/widgets/Table";
import Tooltip from '@material-ui/core/Tooltip';
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useListing } from "@/util/storage";
import Progress from "@/widgets/Progress";
import Actions, { useActions } from "./Storage/Actions";
import { setPath, addPath } from "@/util/pages";
import storage from "@/data/storage";
import ItemMenu from "./Storage/ItemMenu";
import Checkbox from '@material-ui/core/Checkbox';
import styles from "./Storage.module.scss";
import Edit from "./Storage/Edit";
import { Store } from "pullstate";
import { abbreviateSize } from "@/util/string";
import Typography from '@material-ui/core/Typography';
import StatusBar from "./Storage/StatusBar";
import { useDeviceType } from "@/util/styles";
import Destination from "./Storage/Destination";

export const StorageStoreDefaults = {
    mode: "",
    type: "",
    name: "",
    placeholder: "",
    icon: null,
    tooltip: null,
    editing: false,
    select: null,
    counter: 1,
    onDone: null,
    onValidate: null,
    enableItemClick: true,
    item: null,
    destination: false
};

export const StorageStore = new Store(StorageStoreDefaults);

export function getStorageSection({ index, id, translations }) {
    let icon = <FolderIcon />;
    let tooltip = translations.FOLDER;
    if (index <= 1) {
        tooltip = translations.STORAGE;
        icon = <StorageIcon />;
    }
    let name = id;
    if (index) {
        const item = storage.find(item => item.id === id);
        if (item) {
            name = translations[item.name];
        }
    }
    return { icon, name, id: name, tooltip };
}

export default function Storage({ path = "" }) {
    const translations = useTranslations();
    const { item: editedItem, mode, select, counter, enableItemClick } = StorageStore.useState();
    const [data, loading] = useListing(path, [counter]);
    const isPhone = useDeviceType() === "phone";

    useEffect(() => {
        StorageStore.update(s => {
            Object.assign(s, StorageStoreDefaults);
        });
    }, [path]);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        !isPhone && {
            id: "sizeWidget",
            title: translations.SIZE,
            sortable: "size"
        }
    ];

    const mapper = item => {
        const id = item.id || item.name;
        let name = item.name;
        let tooltip = translations.STORAGE;
        let icon = <StorageIcon />;
        if (path) {
            if (item.type === "dir") {
                icon = <FolderIcon />;
                tooltip = translations.FOLDER;
            }
            else {
                icon = <InsertDriveFileIcon />;
                tooltip = translations.FILE;
            }
        }
        else {
            name = translations[item.name];
        }

        let result = {
            ...item,
            name,
            id,
            tooltip,
            icon,
            sizeWidget: item.type === "file" && <Tooltip
                title={item.size + " " + translations.BYTES}
                arrow>
                <Typography style={{ display: "inline-block" }}>
                    {abbreviateSize(item.size)}
                </Typography>
            </Tooltip>
        };

        const selectItem = (event) => {
            const { checked } = event.target;
            StorageStore.update(s => {
                if (checked) {
                    s.select = [...select, result];
                }
                else {
                    s.select = select.filter(item => item.id !== id);
                }
            });
        };

        let nameWidget = null;
        if (mode === "create" && item.create) {
            nameWidget = <Edit key={id} />;
        } else if (mode === "rename" && editedItem.id === id) {
            nameWidget = <Edit key={id} />;
        } else {
            nameWidget = <Label key={id} icon={<>
                {!select && item.type && !mode && <ItemMenu item={result} />}
                {select && <Checkbox
                    classes={{ root: styles.checkbox }}
                    color="default"
                    checked={select.find(item => item.id === id) ? true : false}
                    onChange={selectItem} />}
                <Tooltip title={tooltip} arrow>
                    {icon}
                </Tooltip>
            </>} name={name} />;
        }

        Object.assign(result, {
            nameWidget
        });

        return result;
    };

    let dataEx = useActions(data);

    const rowClick = useCallback((_, item) => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            StorageStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        if (item.type === "file") {
            addPath(`editor?name=${item.name}`);
        }
        else {
            setPath("storage/" + [path, id].filter(Boolean).join("/"));
        }
    }, [select, path]);

    const onRowClick = enableItemClick && rowClick;
    const statusBar = <StatusBar data={dataEx} mapper={mapper} />;

    return <>
        <Table
            rowClick={onRowClick}
            rowHeight="6em"
            columns={columns}
            data={dataEx}
            mapper={mapper}
            depends={[mode, select, path]}
            statusBar={statusBar} />
        {loading && <Progress />}
        <Actions path={path} />
        <Destination path={path} />
    </>;
}
