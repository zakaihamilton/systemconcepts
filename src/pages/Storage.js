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

export const StorageStoreDefaults = {
    type: "",
    name: "",
    placeholder: "",
    icon: null,
    editing: false,
    select: null,
    counter: 1,
    onDone: null,
    onValidate: null,
    enableItemClick: true
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
    const { mode, select, counter, enableItemClick } = StorageStore.useState();
    const [listing, loading] = useListing(path, [counter]);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    let items = (listing || []).map(item => {
        const id = item.id || item.name;
        const name = translations[item.name] || item.name;
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

        let result = {
            ...item,
            name,
            id,
            icon
        };

        const selectItem = () => {
            const exists = select.find(item => item.id === id);
            StorageStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, result];
                }
            });
        };

        let nameWidget = null;
        if (mode === "rename") {
            nameWidget = <Edit />;
        } else {
            nameWidget = <Label key={id} icon={<>
                {!select && <ItemMenu item={result} />}
                {select && <Checkbox
                    classes={{ root: styles.checkbox }}
                    color="default"
                    checked={select.find(item => item.id === id)}
                    onClick={selectItem} />}
                <Tooltip title={tooltip} arrow>
                    {icon}
                </Tooltip>
            </>} name={name} />;
        }

        Object.assign(result, {
            nameWidget
        });

        return result;
    });

    useActions(items);

    const rowClick = (_, id) => {
        const item = items.find(item => item.id === id);
        if (item.type === "file") {
            addPath(`editor?name=${item.name}`);
        }
        else {
            setPath("storage/" + [path, id].filter(Boolean).join("/"));
        }
    };

    const onRowClick = enableItemClick && !select && !mode && rowClick;

    return <>
        <Table rowClick={onRowClick} rowHeight="6em" columns={columns} items={items} />
        {loading && <Progress />}
        <Actions path={path} />
    </>;
}
