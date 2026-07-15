import ItemMenu from "@components/ItemMenu";
import DeleteIcon from "@icons/svg/Delete.svg";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
export default function ItemMenuWidget({ item, store }) {
	const translations = useTranslations();

	const menuItems = [
		{
			id: "delete",
			name: translations.DELETE,
			icon: <DeleteIcon />,
			onClick: () => {
				store.update((s) => {
					s.select = [item];
					s.mode = "delete";
					s.severity = "error";
					s.onDone = async (select) => {
						const records = select.map((item) => ({ id: item.id }));
						await fetchJSON("/api/users", {
							body: JSON.stringify(records),
							method: "DELETE",
						});
					};
				});
			},
		},
	];

	return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
