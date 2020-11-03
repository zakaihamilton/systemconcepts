import { useTranslations } from "@util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import ItemMenu from "@components/ItemMenu";

export default function ItemMenuWidget({ viewMode = "tree", item, store, remove }) {
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
                            await remove(item.contentId);
                        }
                    }
                });
            }
        }
    ];

    return <ItemMenu viewMode={viewMode} item={item} menuItems={menuItems} store={store} />;
}
