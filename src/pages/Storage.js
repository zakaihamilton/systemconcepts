import { useCallback, useEffect } from "react";
import Table from "@widgets/Table";
import Tooltip from '@material-ui/core/Tooltip';
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useTranslations } from "@util/translations";
import Label from "@widgets/Label";
import storage, { useListing } from "@util/storage";
import Actions, { useActions } from "./Storage/Actions";
import { setPath, addPath } from "@util/pages";
import devices from "@data/storage";
import ItemMenu from "./Storage/ItemMenu";
import Select from '@components/Widgets/Select';
import Edit from "./Storage/Edit";
import { Store } from "pullstate";
import { abbreviateSize } from "@util/string";
import Typography from '@material-ui/core/Typography';
import StatusBar from "@widgets/StatusBar";
import Destination from "./Storage/Destination";
import { useDateFormatter } from "@util/locale";
import { useSync } from "@util/sync";
import { isBinaryFile, isImageFile, isVideoFile, isAudioFile } from "@util/path";

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
    destination: "",
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const StorageStore = new Store(StorageStoreDefaults);

export function getStorageSection({ sectionIndex, id, translations }) {
    let icon = <FolderIcon />;
    let tooltip = translations.FOLDER;
    if (sectionIndex <= 1) {
        tooltip = translations.STORAGE;
        icon = <StorageIcon />;
    }
    let name = id;
    if (sectionIndex) {
        const item = devices.find(item => item.id === id);
        if (item) {
            name = translations[item.name] || item.name;
            id = name;
        }
    }
    else {
        name = translations.STORAGE;
    }
    return { icon, name, id, tooltip };
}

export default function Storage({ path = "" }) {
    const [syncCounter] = useSync();
    const translations = useTranslations();
    const { item: editedItem, viewMode, mode, select, counter, enableItemClick, editing } = StorageStore.useState();
    const [data, loading, error] = useListing(path, [counter, syncCounter]);
    const device = devices.find(item => item.id === path.split("/")[0]);
    const { readOnly } = device || {};
    const dateFormatter = useDateFormatter({
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: "2-digit",
        minute: "2-digit"
    });

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
        {
            id: "sizeWidget",
            title: translations.SIZE,
            sortable: "size"
        },
        {
            id: "dateWidget",
            title: translations.DATE,
            sortable: "mtimeMs"
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
            name = translations[item.name] || name;
        }

        const size = item.size || 0;

        let result = {
            ...item,
            name,
            id,
            tooltip,
            icon,
            sizeWidget: item.type === "file" && <Tooltip
                title={size + " " + translations.BYTES}
                arrow>
                <Typography style={{ display: "inline-block" }}>
                    {abbreviateSize(size)}
                </Typography>
            </Tooltip>,
            dateWidget: item.mtimeMs && dateFormatter.format(item.mtimeMs)
        };

        let nameWidget = null;
        if (mode === "create" && item.create) {
            nameWidget = <Edit key={id} />;
        } else if (mode === "rename" && editedItem.id === id) {
            nameWidget = <Edit key={id} />;
        } else {
            nameWidget = <Label key={id} icon={<>
                {item.type && !mode && <ItemMenu viewMode={viewMode} readOnly={readOnly} item={result} />}
                <Tooltip title={tooltip} arrow>
                    {icon}
                </Tooltip>
            </>} name={name} />;
        }

        result.nameWidget = nameWidget;
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
            if (isImageFile(item.name)) {
                addPath(`image?name=${item.name}`);
            }
            else if (isBinaryFile(item.name)) {
                /* add media player here */
            }
            else {
                addPath(`editor?name=${item.name}`);
            }
        }
        else {
            setPath("storage/" + id.split("/").filter(Boolean).join("/"));
        }
    }, [select, path]);

    const onRowClick = enableItemClick && !editing && rowClick;
    const statusBar = <StatusBar data={dataEx} mapper={mapper} store={StorageStore} />;

    const onImport = async (data) => {
        try {
            await storage.importFolder(path, data);
            StorageStore.update(s => {
                s.counter++;
            });
        }
        catch (err) {
            console.error(err);
            StorageStore.update(s => {
                s.message = err;
                s.severity = "error";
            });
        }
    };

    const name = path.split("/").pop();

    const onExport = async () => {
        const object = await storage.exportFolder(path);
        const data = JSON.stringify(object, null, 4);
        return data;
    };

    return <>
        <Table
            name={name}
            rowClick={onRowClick}
            columns={columns}
            store={StorageStore}
            data={dataEx}
            mapper={mapper}
            loading={loading}
            error={error}
            depends={[mode, select, path, onRowClick, dateFormatter]}
            onExport={onExport}
            onImport={!readOnly && onImport}
            statusBar={statusBar}
        />
        <Actions path={path} data={dataEx} readOnly={readOnly} />
        <Destination path={path} />
    </>;
}
