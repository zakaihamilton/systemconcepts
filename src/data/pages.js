import Apps from "@/pages/Apps";
import AppsIcon from '@material-ui/icons/Apps';

import PeopleIcon from '@material-ui/icons/People';

import RecentActorsIcon from '@material-ui/icons/RecentActors';

import Settings from "@/pages/Settings";
import SettingsIcon from '@material-ui/icons/Settings';

import Languages from "@/pages/Languages";
import LanguageIcon from '@material-ui/icons/Language';

export default [
    {
        id: "Apps",
        name: "Apps",
        root: true,
        Icon: AppsIcon,
        Component: Apps,
        sidebar: true,
        separator: true
    },
    {
        sidebar: true,
        id: "users",
        name: "Users",
        Icon: PeopleIcon
    },
    {
        sidebar: true,
        id: "roles",
        name: "Roles",
        Icon: RecentActorsIcon
    },
    {
        sidebar: true,
        id: "languages",
        name: "Languages",
        Icon: LanguageIcon,
        Component: Languages
    },
    {
        sidebar: true,
        id: "settings",
        name: "Settings",
        Icon: SettingsIcon,
        Component: Settings
    }
];
