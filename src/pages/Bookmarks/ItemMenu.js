import { useTranslations } from "@/util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import { BookmarksStore as Bookmarks } from "@/components/Bookmarks";
import ItemMenu from "@/components/ItemMenu";

export default function ItemMenuWidget({ viewMode, item, store }) {
    const translations = useTranslations();

    const items = [
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                store.update(s => {
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

    return <ItemMenu viewMode={viewMode} items={items} store={store} />;
}
