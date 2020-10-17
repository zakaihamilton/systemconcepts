import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import Tooltip from '@material-ui/core/Tooltip';
import { BookmarksStore as Bookmarks } from "@/components/Bookmarks";
import { BookmarksStore } from "../Bookmarks";

export default function ItemMenuWidget({ item }) {
    const [ref, isHover] = useHover();
    const isVisible = useRef();
    const translations = useTranslations();

    const items = [
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                BookmarksStore.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "info";
                    s.onDone = async select => {
                        Bookmarks.update(s => {
                            s.bookmarks = s.bookmarks.filter(bookmark => {
                                return !select.find(item => item.id === bookmark.id);
                            });
                        });
                    }
                });
            }
        }
    ];

    const updateHover = () => {
        if (!isVisible.current) {
            BookmarksStore.update(s => {
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
