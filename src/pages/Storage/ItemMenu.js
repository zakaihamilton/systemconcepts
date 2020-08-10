import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from "@/widgets/IconButton";
import { StorageStore } from "../Storage";
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";

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
                    s.placeholder = translations[placeholder];
                    s.editing = true;
                    s.onDone = async name => {
                        await storage.rename(item.path, [item.folder, name].filter(Boolean).join("/"));
                    };
                });
            }
        },
        {
            id: "delete",
            name: translations.DELETE,
            onClick: () => {
                StorageStore.update(s => {
                    s.select = [item];
                });
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
                <MoreVertIcon />
            </IconButton>
        </Menu>
    </>);
}
