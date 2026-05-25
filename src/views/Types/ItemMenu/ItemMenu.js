import ItemMenu from "@components/ItemMenu";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "@util/domain/translations";

export default function ItemMenuWidget({ item, store, setData }) {
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
						const ids = select.map((item) => item.id);
						setData((data) => {
							data = data.map((item) => ({ ...item }));
							data = data.filter((item) => {
								return !ids.includes(item.id);
							});
							return data;
						});
					};
				});
			},
		},
	];

	return <ItemMenu item={item} menuItems={menuItems} store={store} />;
}
