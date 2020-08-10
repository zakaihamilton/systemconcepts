import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from "@/widgets/IconButton";
import { ActionStore } from "./Actions";
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";
import styles from "./ItemMenu.module.scss";

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
                ActionStore.update(s => {
                    s.mode = "rename";
                    s.type = item.type;
                    s.name = item.name;
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
                ActionStore.update(s => {
                    s.select = [item];
                });
            }
        }
    ];

    const updateHover = () => {
        if (!isVisible.current) {
            ActionStore.update(s => {
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

    const className = !item.type && styles.hide || undefined;

    return (<>
        <Menu items={items} onVisible={onMenuVisible}>
            <IconButton ref={ref} className={className}>
                <MoreVertIcon />
            </IconButton>
        </Menu>
    </>);
}
