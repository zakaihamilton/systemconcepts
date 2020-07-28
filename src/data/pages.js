import Apps from "@/pages/Apps";
import AppsIcon from '@material-ui/icons/Apps';

import PeopleIcon from '@material-ui/icons/People';

import RecentActorsIcon from '@material-ui/icons/RecentActors';

import Settings from "@/pages/Settings";
import SettingsIcon from '@material-ui/icons/Settings';

export default [
    {
        id: "Apps",
        name: "Apps",
        root: true,
        Icon: AppsIcon,
        Page: Apps,
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
        id: "settings",
        name: "Settings",
        Icon: SettingsIcon,
        Page: Settings
    }
];
