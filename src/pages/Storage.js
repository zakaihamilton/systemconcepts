import { useCallback, useEffect } from "react";
import Table from "@/widgets/Table";
import Tooltip from '@material-ui/core/Tooltip';
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useListing } from "@/util/storage";
import Actions, { useActions } from "./Storage/Actions";
import { setPath, addPath } from "@/util/pages";
import storage from "@/data/storage";
import ItemMenu from "./Storage/ItemMenu";
import Select from '@/components/Widgets/Select';
import Edit from "./Storage/Edit";
import { Store } from "pullstate";
import { abbreviateSize } from "@/util/string";
import Typography from '@material-ui/core/Typography';
import StatusBar from "@/widgets/StatusBar";
import { useDeviceType } from "@/util/styles";
import Destination from "./Storage/Destination";
import { useDateLocale } from "@/util/locale";

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
    destination: ""
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
    else {
        name = translations.STORAGE;
    }
    return { icon, name, id: name, tooltip };
}

export default function Storage({ path = "" }) {
    const translations = useTranslations();
    const { item: editedItem, mode, select, counter, enableItemClick, editing } = StorageStore.useState();
    const [data, loading] = useListing(path, [counter]);
    const isPhone = useDeviceType() === "phone";
    const dateFormatter = useDateLocale({
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
        !isPhone && {
            id: "sizeWidget",
            title: translations.SIZE,
            sortable: "size"
        },
        !isPhone && {
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
                {!select && item.type && !mode && <ItemMenu item={result} />}
                {select && <Select select={select} item={result} store={StorageStore} />}
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
            addPath(`editor?name=${item.name}`);
        }
        else {
            setPath("storage/" + id.split("/").filter(Boolean).join("/"));
        }
    }, [select, path]);

    const onRowClick = enableItemClick && !editing && rowClick;
    const statusBar = <StatusBar data={dataEx} mapper={mapper} store={StorageStore} />;

    return <>
        <Table
            rowClick={onRowClick}
            rowHeight="6em"
            columns={columns}
            data={dataEx}
            mapper={mapper}
            loading={loading}
            depends={[mode, select, path, onRowClick, dateFormatter]}
            statusBar={statusBar} />
        <Actions path={path} data={dataEx} />
        <Destination path={path} />
    </>;
}
