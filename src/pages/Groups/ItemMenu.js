import { useTranslations } from "@util/translations";
import ItemMenu from "@components/ItemMenu";
import UpdateIcon from "@material-ui/icons/Update";

export default function ItemMenuWidget({ item, updateGroup, store }) {
    const translations = useTranslations();

    const menuItems = [
        {
            id: "sync",
            name: translations.SYNC,
            icon: <UpdateIcon />,
            onClick: () => {
                updateGroup && updateGroup(item.name);
            }
        }
    ];

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
