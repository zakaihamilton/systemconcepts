import { useEffect, useRef } from "react";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import { useHover } from "@/util/hooks";
import Menu from "@/widgets/Menu";
import { useTranslations } from "@/util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import Tooltip from '@material-ui/core/Tooltip';
import { TimestampsStore } from "../Timestamps";

export default function ItemMenuWidget({ viewMode, setMetadata, item }) {
    const [ref, isHover] = useHover();
    const isVisible = useRef();
    const translations = useTranslations();

    const items = [
        {
            id: "rename",
            name: translations.RENAME,
            onClick: () => {
                TimestampsStore.update(s => {
                    s.mode = "rename";
                    s.type = item.type;
                    s.name = item.name;
                    s.item = item;
                    s.icon = item.icon;
                    s.tooltip = item.tooltip;
                    s.placeholder = "";
                    s.editing = true;
                    s.onValidate = async name => {
                        return !!name;
                    };
                    s.onDone = async name => {
                        setMetadata(metadata => {
                            const timestamps = [...metadata.timestamps].map(timestamp => {
                                timestamp = { ...timestamp };
                                if (timestamp.id === item.id) {
                                    timestamp.name = name;
                                }
                                return timestamp;
                            });
                            return { ...metadata, timestamps };
                        });
                    }
                });
            }
        },
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                TimestampsStore.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "info";
                    s.onDone = async select => {
                        setMetadata(metadata => {
                            metadata.timestamps = metadata.timestamps.filter(timestamp => {
                                return !select.find(item => item.id === timestamp.id);
                            });
                            return { ...metadata };
                        });
                    }
                });
            }
        }
    ];

    const updateHover = () => {
        if (viewMode === "table") {
            if (!isVisible.current) {
                TimestampsStore.update(s => {
                    s.enableItemClick = !isHover;
                });
            }
        }
    };

    const onMenuVisible = visible => {
        isVisible.current = visible;
        updateHover();
    };

    useEffect(() => {
        updateHover();
    }, [isHover]);

    return (<Menu items={items} onVisible={onMenuVisible}>
        <IconButton ref={ref}>
            <Tooltip title={translations.MENU}>
                <MoreVertIcon />
            </Tooltip>
        </IconButton>
    </Menu>);
}
