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

export function getStorageSection({ index, id, translations }) {
    const icon = index > 1 ? <FolderIcon /> : <StorageIcon />;
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
    const { editing, counter } = ActionStore.useState();
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
        const icon = path ? (item.type === "dir" ? <FolderIcon /> : <InsertDriveFileIcon />) : <StorageIcon />;
        return {
            ...item,
            name,
            id: item.id || item.name,
            nameWidget: <Label key={item.id} icon={icon} name={name} />
        };
    });

    useActions(items);

    const rowClick = (_, id) => {
        setPath("storage/" + [path, id].filter(Boolean).join("/"));
    };

    return <>
        <Table rowClick={!editing && rowClick} columns={columns} items={items} />
        {loading && <Progress />}
        <Actions path={path} />
    </>;
}
