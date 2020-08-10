import { useEffect } from "react";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import storage from "@/util/storage";
import SpeedDial from "@/widgets/SpeedDial";
import AddIcon from '@material-ui/icons/Add';
import FolderIcon from '@material-ui/icons/Folder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import StatusBar from "./StatusBar";
import Edit from "./Edit";

const ActionStoreDefaults = {
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

export const ActionStore = new Store(ActionStoreDefaults);

export function useActions(items) {
    const { name, mode, type } = ActionStore.useState();
    if (mode === "create") {
        items.unshift({
            id: type,
            name: name[0],
            nameWidget: <Edit />
        });
    }

    useEffect(() => {
        return () => {
            ActionStore.update(s => {
                Object.assign(s, ActionStoreDefaults);
            });
        }
    }, []);
}

export default function Actions({ path }) {
    const { editing } = ActionStore.useState();
    const translations = useTranslations();

    const addItems = [
        {
            id: "file",
            name: "NEW_FILE",
            icon: <InsertDriveFileIcon />,
            placeholder: "FILE_NAME_PLACEHOLDER",
            onDone: async name => {
                await storage.createFile(path + "/" + name);
            }
        },
        {
            id: "folder",
            name: "NEW_FOLDER",
            icon: <FolderIcon />,
            placeholder: "FOLDER_NAME_PLACEHOLDER",
            onDone: async name => {
                await storage.createFolder(path + "/" + name);
            }
        }
    ].map(item => {
        return {
            onClick: () => {
                ActionStore.update(s => {
                    s.type = item.id;
                    s.name = "";
                    s.icon = item.icon;
                    s.placeholder = translations[item.placeholder];
                    s.mode = "create";
                    s.onDone = item.onDone;
                    s.onValidate = item.onValidate;
                });
            },
            ...item,
            name: translations[item.name]
        }
    });

    return (
        <>
            <StatusBar />
            <SpeedDial visible={!editing && path} items={addItems} icon={<AddIcon />} />
        </>
    );
}
