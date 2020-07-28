import PeopleIcon from '@material-ui/icons/People';
import RecentActorsIcon from '@material-ui/icons/RecentActors';
import SettingsIcon from '@material-ui/icons/Settings';
import AppsIcon from '@material-ui/icons/Apps';

export default [
    {
        id: "Apps",
        name: "Apps",
        root: true,
        icon: AppsIcon
    },
    {
        sidebar: true,
        id: "users",
        name: "Users",
        icon: PeopleIcon
    },
    {
        sidebar: true,
        id: "roles",
        name: "Roles",
        icon: RecentActorsIcon
    },
    {
        sidebar: true,
        id: "settings",
        name: "Settings",
        icon: SettingsIcon
    }
];
