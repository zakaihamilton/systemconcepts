import { useTranslations } from "@util/translations";
import ItemMenu from "@components/ItemMenu";
import UpdateIcon from "@material-ui/icons/Update";

export default function ItemMenuWidget({ item, syncGroup, store }) {
    const translations = useTranslations();

    const menuItems = [
        {
            id: "sync",
            name: translations.SYNC,
            icon: <UpdateIcon />,
            onClick: () => {
                syncGroup(item.name)
            }
        }
    ];

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
