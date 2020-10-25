import { MainStore } from "@components/Main";
import { useTranslations } from "@util/translations";
import List from "@widgets/List";
import { Divider } from "@material-ui/core";
import LanguageIcon from '@material-ui/icons/Language';
import languages from "@data/languages";
import { usePages } from "@util/pages";
import Brightness7Icon from '@material-ui/icons/Brightness7';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import ReplayIcon from '@material-ui/icons/Replay';
import BuildIcon from '@material-ui/icons/Build';
import DeveloperModeIcon from '@material-ui/icons/DeveloperMode';
import { useToolbarItems } from "@components/Toolbar";
import { useLanguage } from "@util/language";

export default function QuickAccess({ closeDrawer, state }) {
    const { darkMode, menuViewList } = MainStore.useState();
    const language = useLanguage();
    const translations = useTranslations();
    const pages = usePages();
    const advancedToolbar = useToolbarItems({ location: "advanced" });

    const toggleDarkMode = () => {
        MainStore.update(s => {
            s.darkMode = !s.darkMode;
            s.autoDetectDarkMode = false;
        });
    };

    const setLanguage = (id) => {
        MainStore.update(s => {
            s.language = id;
        });
    };

    const reload = () => {
        location.reload();
    };

    const toolsItems = pages.filter(page => page.sidebar && page.category === "tools");

    const quickAccessItems = [
        {
            id: "reload",
            name: translations.RELOAD,
            icon: <ReplayIcon />,
            onClick: reload
        },
        {
            id: "toggleDarkMode",
            name: darkMode ? translations.LIGHT_MODE : translations.DARK_MODE,
            icon: darkMode ? <Brightness7Icon /> : <Brightness4Icon />,
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
                }
            }),
            selected: language,
            divider: true
        },
        {
            id: "tools",
            name: translations.TOOLS,
            icon: <BuildIcon />,
            items: toolsItems
        },
        ...pages.filter(page => page.sidebar && page.category === "quickaccess"),
        advancedToolbar && advancedToolbar.length && {
            id: "advanced",
            name: translations.ADVANCED,
            icon: <DeveloperModeIcon />,
            items: [...advancedToolbar],
            divider: true
        }
    ].filter(Boolean);

    return <>
        <div style={{ flex: "1" }} />
        <Divider style={{ color: "var(1px solid --border)", marginTop: "0.5em", marginBottom: "0.5em" }} />
        <List items={quickAccessItems} onClick={closeDrawer} state={state} viewType={menuViewList} />
    </>;
}
