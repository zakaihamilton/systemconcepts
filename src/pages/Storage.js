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
    const { editing, counter, enableItemClick } = ActionStore.useState();
    const [listing, loading] = useListing(path, [counter]);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    let items = (listing || []).map(item => {
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
        return {
            ...item,
            name,
            id: item.id || item.name,
            icon,
            nameWidget: <Label key={item.id} icon={<>
                <ItemMenu item={item} />
                {icon}
            </>} name={name} />
        };
    });

    useActions(items);

    const rowClick = (_, id) => {
        setPath("storage/" + [path, id].filter(Boolean).join("/"));
    };

    return <>
        <Table rowClick={enableItemClick && !editing && rowClick} columns={columns} items={items} />
        {loading && <Progress />}
        <Actions path={path} />
    </>;
}
