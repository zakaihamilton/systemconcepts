import Apps from "@/pages/Apps";
import AppsIcon from '@material-ui/icons/Apps';

import PeopleIcon from '@material-ui/icons/People';

import RecentActorsIcon from '@material-ui/icons/RecentActors';

import Settings from "@/pages/Settings";
import SettingsIcon from '@material-ui/icons/Settings';

import Languages from "@/pages/Languages";
import LanguageIcon from '@material-ui/icons/Language';

import TranslateIcon from '@material-ui/icons/Translate';
import Translations from "@/pages/Translations";

export default [
    {
        id: "Apps",
        name: "APPS_NAME",
        root: true,
        Icon: AppsIcon,
        Component: Apps,
        sidebar: true,
        separator: true
    },
    {
        sidebar: true,
        id: "users",
        name: "USERS_NAME",
        Icon: PeopleIcon
    },
    {
        sidebar: true,
        id: "roles",
        name: "ROLES_NAME",
        Icon: RecentActorsIcon
    },
    {
        sidebar: true,
        id: "languages",
        name: "LANGUAGES_NAME",
        Icon: LanguageIcon,
        Component: Languages
    },
    {
        sidebar: true,
        id: "translations",
        name: "TRANSLATIONS_NAME",
        Icon: TranslateIcon,
        Component: Translations
    },
    {
        sidebar: true,
        id: "settings",
        name: "SETTINGS_NAME",
        Icon: SettingsIcon,
        Component: Settings
    }
];
