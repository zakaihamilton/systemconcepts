import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import { StorageStore } from "../Storage";
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";
import { exportData } from "@/util/importExport";
import ImportExportIcon from '@material-ui/icons/ImportExport';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import Tooltip from '@material-ui/core/Tooltip';

export default function ItemMenuWidget({ item }) {
    const [ref, isHover] = useHover();
    const isVisible = useRef();
    const translations = useTranslations();

    const items = [
        {
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
                    s.onDone = async name => {
                        if (!name) {
                            return;
                        }
                        name = name.replace(/\//, " ");
                        const target = [item.folder, name].filter(Boolean).join("/");
                        if (item.path !== target) {
                            try {
                                if (await storage.exists(target)) {
                                    throw translations.ALREADY_EXISTS.replace("${name}", name);
                                }
                                await storage.rename(item.path, target);
                            }
                            catch (err) {
                                StorageStore.update(s => {
                                    s.message = err;
                                    s.severity = "error";
                                });
                            }
                        }
                    };
                });
            }
        },
        {
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
                            s.destination = true;
                        });
                        return true;
                    }
                });
            }
        },
        {
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
                            s.destination = true;
                        });
                        return true;
                    }
                });
            }
        },
        {
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
        {
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
                    data = await storage.readFile(item.path, "utf8");
                }
                exportData(data, item.name, "application/json");
            }
        }
    ];

    const updateHover = () => {
        if (!isVisible.current) {
            StorageStore.update(s => {
                s.enableItemClick = !isHover;
            });
        }
    };

    const onMenuVisible = visible => {
        isVisible.current = visible;
        updateHover();
    };

    useEffect(() => {
        updateHover();
    }, [isHover]);

    return (<>
        <Menu items={items} onVisible={onMenuVisible}>
            <IconButton ref={ref}>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>
    </>);
}
