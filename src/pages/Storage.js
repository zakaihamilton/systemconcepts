import Table from "@/widgets/Table";
import StorageIcon from '@material-ui/icons/Storage';
import { useTranslations } from "@/util/translations";
import Label from "@/widgets/Label";
import { useObject } from "@/util/storage";
import SpeedDial from "@/widgets/SpeedDial";
import AddIcon from '@material-ui/icons/Add';
import CreateNewFolderIcon from '@material-ui/icons/CreateNewFolder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';

export default function Storage({ path = "" }) {
    const translations = useTranslations();
    const object = useObject(path);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    const items = (object || []).map(item => {
        const name = translations[item.name];
        return {
            ...item,
            name,
            nameWidget: <Label key={item.id} icon={StorageIcon} name={name} />
        };
    });

    const rowClick = (_, id) => {
        window.location.hash = encodeURI("storage?path=" + [path, id].filter(Boolean).join("/"));
    };

    const addItems = [
        {
            id: "file",
            name: "New File",
            onClick: (event) => {
                const { value } = event.target;
                alert(value);
            },
            icon: <InsertDriveFileIcon />
        },
        {
            id: "folder",
            name: "New Folder",
            onClick: (event) => {
                const { value } = event.target;
                alert(value);
            },
            icon: <CreateNewFolderIcon />
        }
    ];

    return <>
        <Table rowClick={rowClick} columns={columns} items={items} />
        <SpeedDial items={addItems} icon={<AddIcon />} title="Add Item" />
    </>;
}
