import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import { MainStore } from "../../Main";

export default function Menu() {
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
		<Tooltip arrow title={translations.MENU}>
			<IconButton
				aria-label={translations.MENU}
				onClick={toggleMenu}
				size="large"
			>
				<MenuIcon />
			</IconButton>
		</Tooltip>
	);
}
