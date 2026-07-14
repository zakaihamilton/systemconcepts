import { MainStore } from "@components/Main";
import languages from "@data/languages";
import Brightness4Icon from "@icons/Brightness4";
import Brightness7Icon from "@icons/Brightness7";
import BuildIcon from "@icons/Build";
import LanguageIcon from "@icons/Language";
import ReplayIcon from "@icons/Replay";
import { Divider } from "@ui";
import { useLanguage } from "@util/domain/language";
import { useTranslations } from "@util/domain/translations";
import { usePages } from "@util/domain/views";
import List from "@widgets/List";
import useDarkMode from "use-dark-mode";
import styles from "./QuickAccess.module.css";
export default function QuickAccess({ closeDrawer, state, onScrollToBottom }) {
	const language = useLanguage();
	const translations = useTranslations();
	const pages = usePages();
	const darkMode = useDarkMode(false);

	const toggleDarkMode = () => {
		darkMode.toggle();
	};

	const setLanguage = (id) => {
		MainStore.update((s) => {
			s.language = id;
		});
	};

	const reload = () => {
		location.reload();
	};

	const toolsItems = pages
		.filter((page) => page.sidebar && page.category === "tools")
		.map((item) => {
			return { ...item, target: item.path || item.id };
		});

	const handleToggle = (isOpen) => {
		if (isOpen && onScrollToBottom) {
			onScrollToBottom();
		}
	};

	const quickAccessItems = [
		{
			id: "reload",
			name: translations.RELOAD,
			icon: <ReplayIcon />,
			onClick: reload,
		},
		{
			id: "toggleDarkMode",
			name: darkMode.value ? translations.LIGHT_MODE : translations.DARK_MODE,
			icon: darkMode.value ? <Brightness7Icon /> : <Brightness4Icon />,
			onClick: toggleDarkMode,
		},
		{
			id: "language",
			name: translations.LANGUAGE,
			icon: <LanguageIcon />,
			items: languages.map((language) => {
				return {
					...language,
					setSelected: setLanguage,
				};
			}),
			selected: language,
			divider: true,
			onToggle: handleToggle,
		},
		{
			id: "tools",
			name: translations.TOOLS,
			icon: <BuildIcon />,
			items: toolsItems,
			onToggle: handleToggle,
		},
		...pages.filter((page) => page.sidebar && page.category === "quickaccess"),
	].filter(Boolean);

	return (
		<>
			<div style={{ flex: "1" }} />
			<Divider className={styles.divider} />
			<List items={quickAccessItems} onClick={closeDrawer} state={state} />
		</>
	);
}
