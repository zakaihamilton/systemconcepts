import { useTranslations } from "@util/translations";
import ItemMenu from "@components/ItemMenu";
import UpdateIcon from "@mui/icons-material/Update";
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';

export default function ItemMenuWidget({ item, updateGroup, store, setGroups }) {
    const translations = useTranslations();

    const menuItems = [
        {
            id: "sync",
            name: translations.SYNC,
            icon: <UpdateIcon />,
            onClick: () => {
                updateGroup && updateGroup(item.name);
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
        }
    ];

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
