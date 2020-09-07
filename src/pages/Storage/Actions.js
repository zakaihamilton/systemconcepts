import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";
import SpeedDial from "@/widgets/SpeedDial";
import AddIcon from '@material-ui/icons/Add';
import FolderIcon from '@material-ui/icons/Folder';
import CreateNewFolderIcon from '@material-ui/icons/CreateNewFolder';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { StorageStore } from "../Storage";
import { importData } from "@/util/importExport";

export function useActions(data) {
    const { mode, type } = StorageStore.useState();
    if (mode === "create") {
        data = [{
            id: type,
            name: "",
            create: true
        }, ...data];
    }
    return data;
}

export default function Actions({ data, path }) {
    const { mode } = StorageStore.useState();
    const translations = useTranslations();

    const addItems = [
        {
            id: "file",
            name: translations.NEW_FILE,
            icon: <InsertDriveFileIcon />,
            tooltip: translations.FILE,
            placeholder: translations.FILE_NAME_PLACEHOLDER,
            onDone: async name => {
                if (!name) {
                    return;
                }
                const target = path + "/" + name;
                try {
                    if (await storage.exists(target)) {
                        throw translations.ALREADY_EXISTS.replace("${name}", name);
                    }
                    await storage.createFile(target);
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                }
            }
        },
        {
            id: "folder",
            name: translations.NEW_FOLDER,
            icon: <CreateNewFolderIcon />,
            tooltip: translations.FOLDER,
            placeholder: translations.FOLDER_NAME_PLACEHOLDER,
            onDone: async name => {
                if (!name) {
                    return;
                }
                const target = path + "/" + name;
                try {
                    if (await storage.exists(target)) {
                        throw translations.ALREADY_EXISTS.replace("${name}", name);
                    }
                    await storage.createFolder(target);
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                }
            }
        }
    ].map(item => {
        return {
            onClick: () => {
                StorageStore.update(s => {
                    s.type = item.id;
                    s.name = "";
                    s.icon = item.icon;
                    s.tooltip = item.tooltip;
                    s.placeholder = item.placeholder;
                    s.mode = "create";
                    s.onDone = item.onDone;
                    s.onValidate = item.onValidate;
                });
            },
            ...item
        }
    });

    addItems.push(...[
        {
            id: "importFolder",
            name: translations.IMPORT_FOLDER,
            icon: <FolderIcon />,
            tooltip: translations.FOLDER,
            onClick: async () => {
                let body = "";
                try {
                    body = await importData();
                }
                catch (err) {
                    if (err) {
                        StorageStore.update(s => {
                            s.message = err;
                            s.severity = "error";
                        });
                    }
                }
                try {
                    await storage.importFolder(path, JSON.parse(body));
                    StorageStore.update(s => {
                        s.counter++;
                    });
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                }
            }
        }
    ]);

    return (
        <SpeedDial visible={!mode && path && data} items={addItems} icon={<AddIcon />} />
    );
}
