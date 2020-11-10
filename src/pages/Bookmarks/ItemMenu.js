import { useTranslations } from "@util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import { BookmarksStore as Bookmarks } from "@components/Bookmarks";
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

    return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
