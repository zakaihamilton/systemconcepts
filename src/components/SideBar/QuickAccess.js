import { MainStore } from "@components/Main";
import { useTranslations } from "@util/translations";
import List from "@widgets/List";
import { Divider } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import languages from "@data/languages";
import { usePages } from "@util/pages";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import ReplayIcon from "@mui/icons-material/Replay";
import BuildIcon from "@mui/icons-material/Build";
import { useLanguage } from "@util/language";
import useDarkMode from "use-dark-mode";

export default function QuickAccess({ closeDrawer, state, onScrollToBottom }) {
    const language = useLanguage();
    const translations = useTranslations();
    const pages = usePages();
    const darkMode = useDarkMode(false);

    const toggleDarkMode = () => {
        darkMode.toggle();
    };

    const setLanguage = (id) => {
        MainStore.update(s => {
            s.language = id;
        });
    };

    const reload = () => {
        location.reload();
    };

    const toolsItems = pages.filter(page => page.sidebar && page.category === "tools").map(item => {
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
            onClick: reload
        },
        {
            id: "toggleDarkMode",
            name: darkMode.value ? translations.LIGHT_MODE : translations.DARK_MODE,
            icon: darkMode.value ? <Brightness7Icon /> : <Brightness4Icon />,
            onClick: toggleDarkMode
        },
        {
            id: "language",
            name: translations.LANGUAGE,
            icon: <LanguageIcon />,
            items: languages.map(language => {
                return {
                    ...language,
                    setSelected: setLanguage
                };
            }),
            selected: language,
            divider: true,
            onToggle: handleToggle
        },
        {
            id: "tools",
            name: translations.TOOLS,
            icon: <BuildIcon />,
            items: toolsItems,
            onToggle: handleToggle
        },
        ...pages.filter(page => page.sidebar && page.category === "quickaccess")
    ].filter(Boolean);

    return <>
        <div style={{ flex: "1" }} />
        <Divider sx={{ my: 1, opacity: 0.1 }} />
        <List items={quickAccessItems} onClick={closeDrawer} state={state} />
    </>;
}

