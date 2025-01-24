import { useTranslations } from "@util/translations";
import DeleteIcon from "@mui/icons-material/Delete";
import ItemMenu from "@components/ItemMenu";

export default function ItemMenuWidget({ item, store, remove }) {
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
                        for (const item of select) {
                            await remove(item.name);
                        }
                    };
                });
            }
        }
    ];

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
