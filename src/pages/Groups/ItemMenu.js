import { useTranslations } from "@util/translations";
import ItemMenu from "@components/ItemMenu";
import UpdateIcon from "@mui/icons-material/Update";
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import Statistics from "./Statistics";
import { useState } from "react";
import DataUsageIcon from "@mui/icons-material/DataUsage";

export default function ItemMenuWidget({ item, updateGroup, store, setGroups, sessions }) {
    const translations = useTranslations();
    const [showStatistics, setShowStatistics] = useState(false);

    const menuItems = [
        {
            id: "statistics",
            name: translations.STATISTICS,
            icon: <DataUsageIcon />,
            onClick: () => setShowStatistics(true)
        },
        {
            id: "sync",
            name: translations.SYNC,
            icon: <UpdateIcon />,
            onClick: () => {
                updateGroup && updateGroup(item.name);
            }
        },
        {
            id: "sync_all",
            name: translations.SYNC_ALL_SESSIONS,
            icon: <UpdateIcon />,
            onClick: () => {
                updateGroup && updateGroup(item.name, true);
            }
        },
        {
            id: "update_tags",
            name: translations.UPDATE_TAGS || "Update Tags",
            icon: <UpdateIcon />,
            onClick: () => {
                updateGroup && updateGroup(item.name, false, true);
            }
        },
        {
            id: "enable_disable",
            name: item.disabled ? translations.ENABLE : translations.DISABLE,
            icon: item.disabled ? <CloudQueueIcon /> : <CloudOffIcon />,
            onClick: () => {
                setGroups(groups => {
                    groups = [...groups];
                    const index = groups.findIndex(group => group.name === item.name);
                    const group = groups[index];
                    group.disabled = !group.disabled;
                    groups[index] = { ...groups[index] };
                    return groups;
                });
            }
        },
        {
            id: "toggle_merged",
            name: (item.merged ?? item.disabled) ? translations.SPLIT : translations.MERGE,
            icon: (item.merged ?? item.disabled) ? <FolderIcon /> : <DescriptionIcon />,
            onClick: () => {
                setGroups(groups => {
                    groups = [...groups];
                    const index = groups.findIndex(group => group.name === item.name);
                    const currentMerged = groups[index].merged ?? groups[index].disabled;
                    groups[index] = { ...groups[index], merged: !currentMerged };
                    return groups;
                });
            }
        },
        {
            id: "toggle_bundled",
            name: item.bundled ? translations.SEPARATE : translations.BUNDLE,
            icon: item.bundled ? <FolderIcon /> : <CloudQueueIcon />,
            onClick: () => {
                setGroups(groups => {
                    groups = [...groups];
                    const index = groups.findIndex(group => group.name === item.name);
                    const currentBundled = groups[index].bundled;
                    groups[index] = { ...groups[index], bundled: !currentBundled };
                    return groups;
                });
            }
        }
    ];

    return <>
        <ItemMenu item={item} menuItems={menuItems} store={store} />
        {showStatistics && <Statistics open={showStatistics} onClose={() => setShowStatistics(false)} group={item} sessions={sessions} />}
    </>;
}
