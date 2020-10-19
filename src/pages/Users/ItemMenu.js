import { UsersStore } from "../Users";
import { useTranslations } from "@/util/translations";
import DeleteIcon from '@material-ui/icons/Delete';
import { fetchJSON } from "@/util/fetch";
import ItemMenu from "@/components/ItemMenu";

export default function ItemMenuWidget({ viewMode, item }) {
    const translations = useTranslations();

    const items = [
        {
            id: "delete",
            name: translations.DELETE,
            icon: <DeleteIcon />,
            onClick: () => {
                UsersStore.update(s => {
                    s.select = [item];
                    s.mode = "delete";
                    s.severity = "info";
                    s.onDone = async select => {
                        const records = select.map(item => ({ id: item.id }));
                        await fetchJSON("/api/users", { body: JSON.stringify(records), method: "DELETE" });
                    }
                });
            }
        }
    ];

    return <ItemMenu viewMode={viewMode} items={items} store={UsersStore} />;
}
