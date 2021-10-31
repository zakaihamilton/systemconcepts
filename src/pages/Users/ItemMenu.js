import { useTranslations } from "@util/translations";
import DeleteIcon from "@material-ui/icons/Delete";
import { fetchJSON } from "@util/fetch";
import ItemMenu from "@components/ItemMenu";

export default function ItemMenuWidget({ item, store }) {
    const translations = useTranslations();

    const menuItems = [
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                store.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "error";
                    s.onDone = async select => {
                        const records = select.map(item => ({ id: item.id }));
                        await fetchJSON("/api/users", { body: JSON.stringify(records), method: "DELETE" });
                    };
                });
            }
        }
    ];

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
