import { StorageStore } from "../Storage";
import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";
import { exportData } from "@/util/importExport";
import ImportExportIcon from '@material-ui/icons/ImportExport';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import { isBinaryFile, makePath, fileFolder } from "@/util/path";
import ItemMenu from "@/components/ItemMenu";

export default function ItemMenuWidget({ viewMode, item, readOnly }) {
    const translations = useTranslations();

    const items = [
        !readOnly && {
            id: "rename",
            name: translations.RENAME,
            onClick: () => {
                const placeholder = item.type === "dir" ? "FOLDER_NAME_PLACEHOLDER" : "FILE_NAME_PLACEHOLDER";
                StorageStore.update(s => {
                    s.mode = "rename";
                    s.type = item.type;
                    s.name = item.name;
                    s.item = item;
                    s.icon = item.icon;
                    s.tooltip = item.tooltip;
                    s.placeholder = translations[placeholder];
                    s.editing = true;
                    s.onValidate = async name => {
                        if (!name) {
                            return false;
                        }
                        name = name.replace(/\//, " ");
                        const target = makePath(fileFolder(item.path), name);
                        if (makePath(item.path) === makePath(target)) {
                            return false;
                        }
                        return true;
                    };
                    s.onDone = async name => {
                        name = name.replace(/\//, " ");
                        const target = makePath(fileFolder(item.path), name);
                        try {
                            if (await storage.exists(target)) {
                                throw translations.ALREADY_EXISTS.replace("${name}", name);
                            }
                            if (item.type === "dir") {
                                await storage.moveFolder(item.path, target);
                            }
                            else {
                                await storage.moveFile(item.path, target);
                            }
                        }
                        catch (err) {
                            StorageStore.update(s => {
                                s.message = err;
                                s.severity = "error";
                            });
                        }
                    }
                });
            }
        },
        !readOnly && {
            id: "move",
            name: translations.MOVE,
            icon: <TrendingFlatIcon />,
            onClick: () => {
                StorageStore.update(s => {
                    s.select = [item];
                    s.mode = "move";
                    s.severity = "info";
                    s.onDone = () => {
                        StorageStore.update(s => {
                            s.destination = fileFolder(item.path);
                        });
                        return true;
                    }
                });
            }
        },
        !readOnly && {
            id: "copy",
            name: translations.COPY,
            icon: <FileCopyIcon />,
            onClick: () => {
                StorageStore.update(s => {
                    s.select = [item];
                    s.mode = "copy";
                    s.severity = "info";
                    s.onDone = () => {
                        StorageStore.update(s => {
                            s.destination = fileFolder(item.path);
                        });
                        return true;
                    }
                });
            }
        },
        !readOnly && {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                StorageStore.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "info";
                    s.onDone = async select => {
                        for (const item of select) {
                            if (item.type === "dir") {
                                await storage.deleteFolder(item.path);
                            }
                            else {
                                await storage.deleteFile(item.path);
                            }
                        }
                    }
                });
            }
        },
        !isBinaryFile(item.name) && {
            id: "export",
            name: translations.EXPORT,
            icon: <ImportExportIcon />,
            onClick: async () => {
                let data = null;
                if (item.type === "dir") {
                    const object = await storage.exportFolder(item.path);
                    data = JSON.stringify({ [item.name]: object }, null, 4);
                }
                else {
                    data = await storage.readFile(item.path);
                }
                exportData(data, item.name, "application/json");
            }
        }
    ].filter(Boolean);

    return <ItemMenu viewMode={viewMode} items={items} store={StorageStore} />;
}
