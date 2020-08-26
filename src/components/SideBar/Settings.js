import Brightness7Icon from '@material-ui/icons/Brightness7';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import ListWidget from "@/widgets/List";
import { Divider } from "@material-ui/core";

export default function Settings() {
    const { darkMode, menuViewList } = MainStore.useState();
    const translations = useTranslations();

    const toggleDarkMode = () => {
        MainStore.update(s => {
            s.darkMode = !s.darkMode;
            s.autoDetectDarkMode = false;
        });
    };

    const Icon = darkMode ? Brightness7Icon : Brightness4Icon;
    const title = darkMode ? translations.LIGHT_MODE : translations.DARK_MODE;

    const items = [
        {
            id: "toggleDarkMode",
            name: title,
            icon: <Icon />,
            onClick: toggleDarkMode
        }
    ];

    return <>
        <div style={{ flex: "1" }} />
        <Divider style={{ color: "var(--border)", marginTop: "0.5em", marginBottom: "0.5em" }} />
        <ListWidget reverse={true} items={items} viewType={menuViewList} />
    </>;
}
