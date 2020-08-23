import Brightness7Icon from '@material-ui/icons/Brightness7';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import { setPath } from "@/util/pages";

export default function Settings() {
    const { darkMode } = MainStore.useState();
    const translations = useTranslations();

    const toggleDarkMode = () => {
        MainStore.update(s => {
            s.darkMode = !s.darkMode;
            s.autoDetectDarkMode = false;
        });
    };

    const gotoAccount = () => {
        setPath("settings", "signin");
    };

    const Icon = darkMode ? Brightness7Icon : Brightness4Icon;
    const title = darkMode ? translations.LIGHT_MODE : translations.DARK_MODE;

    return <>
        <IconButton onClick={toggleDarkMode}>
            <Tooltip title={title} arrow>
                <Icon />
            </Tooltip>
        </IconButton>
        <IconButton onClick={gotoAccount}>
            <Tooltip title={translations.ACCOUNT}>
                <AccountCircleIcon />
            </Tooltip>
        </IconButton>
    </>;
}
