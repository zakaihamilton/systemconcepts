import ItemMenu from "@components/ItemMenu";
import DeleteIcon from "@icons/svg/Delete.svg";
import { useTranslations } from "@util/domain/translations";
export default function ItemMenuWidget({ item, store, setData }: any) {
	const translations = useTranslations();

	const menuItems = [
		{
			id: "delete",
			name: translations.DELETE,
			icon: <DeleteIcon />,
			onClick: () => {
				store.update((s: any) => {
					s.select = [item];
					s.mode = "delete";
					s.severity = "error";
					s.onDone = async (select: any) => {
						const ids = select.map((item: any) => item.id);
						setData((data: any) => {
							data = data.map((item: any) => ({ ...item }));
							data = data.filter((item: any) => {
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
