import MenuIcon from "@icons/Menu";
import IconButton from "@ui/IconButton";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import { MainStore } from "../../Main";
export default function SidebarIcon() {
	const translations = useTranslations();
	const isMobile = useDeviceType() !== "desktop";

	const toggleMenu = () => {
		MainStore.update((s) => {
			if (isMobile) {
				s.showSlider = true;
			} else {
				s.showSideBar = !s.showSideBar;
			}
		});
	};

	return (
		<Tooltip arrow title={translations.SIDEBAR}>
			<IconButton
				aria-label={translations.SIDEBAR}
				onClick={toggleMenu}
				size="large"
			>
				<MenuIcon />
			</IconButton>
		</Tooltip>
	);
}
