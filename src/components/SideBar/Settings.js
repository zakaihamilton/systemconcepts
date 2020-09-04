import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import ListWidget from "@/widgets/List";
import { Divider } from "@material-ui/core";
import LanguageIcon from '@material-ui/icons/Language';
import languages from "@/data/languages";
import { usePages } from "@/util/pages";
import Brightness7Icon from '@material-ui/icons/Brightness7';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import BuildIcon from '@material-ui/icons/Build';

export default function Settings({ closeDrawer, state }) {
    const { language, darkMode, menuViewList } = MainStore.useState();
    const translations = useTranslations();
    const pages = usePages();

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

    const quickAccessItems = [
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
            selected: language
        },
        {
            id: "tools",
            name: translations.TOOLS,
            icon: <BuildIcon />,
            items: pages.filter(page => page.sidebar && page.category === "tools")
        }
    ];

    return <>
        <div style={{ flex: "1" }} />
        <Divider style={{ color: "var(--border)", marginTop: "0.5em", marginBottom: "0.5em" }} />
        <ListWidget reverse={true} items={quickAccessItems} onClick={closeDrawer} state={state} viewType={menuViewList} />
    </>;
}
