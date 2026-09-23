import Checkbox from "@ui/Checkbox";
import styles from "./Select.module.css";

export default function SelectWidget({ item, store, select }: any) {
	const { id } = item;
	const selectItem = (event: any) => {
		const { checked } = event.target;
		store.update((s: any) => {
			if (checked) {
				s.select = [...select, item];
			} else {
				s.select = select.filter((item: any) => item.id !== id);
			}
		});
	};

	const checked = select.find((item: any) => item.id === id) ? true : false;

	return (
		<Checkbox
			color="default"
			classes={{ root: styles.root }}
			checked={checked}
			onClick={(e: any) => e.stopPropagation()}
			onChange={selectItem}
		/>
	);
}
