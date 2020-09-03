import Brightness7Icon from '@material-ui/icons/Brightness7';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import ListWidget from "@/widgets/List";
import { Divider } from "@material-ui/core";
import LanguageIcon from '@material-ui/icons/Language';
import languages from "@/data/languages";
import { usePages } from "@/util/pages";

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

    const Icon = darkMode ? Brightness7Icon : Brightness4Icon;
    const title = darkMode ? translations.LIGHT_MODE : translations.DARK_MODE;

    const settingsItems = pages.filter(page => page.sidebar && page.settings);
    const quickAccessItems = [
        {
            id: "toggleDarkMode",
            name: title,
            icon: <Icon />,
            onClick: toggleDarkMode
        },
        {
            id: "language",
            name: translations.LANGUAGE,
            icon: <LanguageIcon />,
            items: languages.map(language => {
                return {
                    ...language,
                    onClick: () => setLanguage(language.id)
                }
            }),
            selected: language
        }
    ];

    return <>
        <div style={{ flex: "1" }} />
        <Divider style={{ color: "var(--border)", marginTop: "0.5em", marginBottom: "0.5em" }} />
        <ListWidget onClick={closeDrawer} state={state} reverse={true} items={settingsItems} viewType={menuViewList} />
        <Divider style={{ color: "var(--border)", marginTop: "0.5em", marginBottom: "0.5em" }} />
        <ListWidget reverse={true} items={quickAccessItems} viewType={menuViewList} />
    </>;
}
