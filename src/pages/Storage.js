import Table from "@/widgets/Table";
import StorageIcon from '@material-ui/icons/Storage';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useListing } from "@/util/storage";
import Progress from "@/widgets/Progress";
import Actions, { useActions, ActionStore } from "./Storage/Actions";
import { setPath } from "@/util/pages";
import storage from "@/data/storage";
import ItemMenu from "./Storage/ItemMenu";
import Checkbox from '@material-ui/core/Checkbox';
import styles from "./Storage.module.scss";

export function getStorageSection({ index, id, translations }) {
    let icon = <FolderIcon />;
    if (index <= 1) {
        icon = <StorageIcon />;
    }
    let name = id;
    if (index) {
        const item = storage.find(item => item.id === id);
        if (item) {
            name = translations[item.name];
        }
    }
    return { icon, name, id: name };
}

export default function Storage({ path = "" }) {
    const translations = useTranslations();
    const { mode, select, counter, enableItemClick } = ActionStore.useState();
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
        const itemPath = item.path || item.name;
        const name = translations[item.name] || item.name;
        let icon = <StorageIcon />;
        if (path) {
            if (item.type === "dir") {
                icon = <FolderIcon />;
            }
            else {
                icon = <InsertDriveFileIcon />;
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
            ActionStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, result];
                }
            });
        };

        Object.assign(result, {
            nameWidget: <Label key={id} icon={<>
                {!select && <ItemMenu item={result} />}
                {select && <Checkbox
                    classes={{ root: styles.checkbox }}
                    color="default"
                    checked={select.find(item => item.id === id)}
                    onClick={selectItem} />}
                {icon}
            </>} name={name} />
        });

        return result;
    });

    useActions(items);

    const rowClick = (_, id) => {
        setPath("storage/" + [path, id].filter(Boolean).join("/"));
    };

    const onRowClick = enableItemClick && !select && mode && rowClick;

    return <>
        <Table rowClick={onRowClick} rowHeight="6em" columns={columns} items={items} />
        {loading && <Progress />}
        <Actions path={path} />
    </>;
}
