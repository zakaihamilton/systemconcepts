import Select from "@components/Widgets/Select";
import MoreVertIcon from "@icons/svg/MoreVert.svg";
import IconButton from "@ui/IconButton";
import { useTranslations } from "@util/domain/translations";
import Menu from "@widgets/Menu";
import Tooltip from "@widgets/Tooltip";
export default function ItemMenuWidget({ item, menuItems, store }) {
	const translations = useTranslations();
	const select = store.useState((s) => s.select);

	return (
		<>
			{!!select && <Select select={select} item={item} store={store} />}
			{!select && (
				<Menu items={menuItems}>
					<Tooltip title={translations.MENU}>
						<IconButton aria-label={translations.MENU} size="large">
							<MoreVertIcon />
						</IconButton>
					</Tooltip>
				</Menu>
			)}
		</>
	);
}
