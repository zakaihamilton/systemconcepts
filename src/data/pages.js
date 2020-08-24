import AppsIcon from '@material-ui/icons/Apps';
import Apps from "@/pages/Apps";

import PeopleIcon from '@material-ui/icons/People';
import Users from "@/pages/Users";

import RecentActorsIcon from '@material-ui/icons/RecentActors';
import Roles from "@/pages/Roles";

import SettingsIcon from '@material-ui/icons/Settings';
import Settings from "@/pages/Settings";

import LanguageIcon from '@material-ui/icons/Language';
import Languages from "@/pages/Languages";

import TranslateIcon from '@material-ui/icons/Translate';
import Translations from "@/pages/Translations";

import FormatSizeIcon from '@material-ui/icons/FormatSize';
import FontSizes from "@/pages/FontSizes";

import StorageIcon from '@material-ui/icons/Storage';
import Storage, { getStorageSection } from "@/pages/Storage";

import SettingsBackupRestoreIcon from '@material-ui/icons/SettingsBackupRestore';
import Reset from "@/pages/Settings/Reset";

import EditIcon from '@material-ui/icons/Edit';
import Editor from "@/pages/Editor";

import VpnKeyIcon from '@material-ui/icons/VpnKey';
import SignIn from "@/pages/SignIn";

import CreateIcon from '@material-ui/icons/Create';
import SignUp from "@/pages/SignUp";

export default [
    {
        id: "apps",
        name: "APPS_NAME",
        root: true,
        icon: <AppsIcon />,
        Component: Apps,
        sidebar: true,
        separator: true
    },
    {
        sidebar: true,
        id: "users",
        name: "USERS_NAME",
        icon: <PeopleIcon />,
        Component: Users
    },
    {
        sidebar: true,
        id: "roles",
        name: "ROLES_NAME",
        icon: <RecentActorsIcon />,
        Component: Roles
    },
    {
        id: "languages",
        name: "LANGUAGES_NAME",
        icon: <LanguageIcon />,
        Component: Languages
    },
    {
        id: "translations",
        name: "TRANSLATIONS_NAME",
        icon: <TranslateIcon />,
        Component: Translations
    },
    {
        id: "fontSizes",
        name: "FONTSIZES_NAME",
        icon: <FormatSizeIcon />,
        Component: FontSizes
    },
    {
        id: "storage",
        name: "STORAGE_NAME",
        icon: <StorageIcon />,
        Component: Storage,
        section: getStorageSection,
        sidebar: true
    },
    {
        sidebar: true,
        id: "settings",
        name: "SETTINGS_NAME",
        icon: <SettingsIcon />,
        Component: Settings
    },
    {
        id: "settings/reset",
        name: "RESET",
        icon: <SettingsBackupRestoreIcon />,
        Component: Reset
    },
    {
        id: "editor",
        name: "EDITOR_NAME",
        icon: <EditIcon />,
        Component: Editor,
        showTooltip: true
    },
    {
        id: "signin",
        name: "SIGN_IN_NAME",
        icon: <VpnKeyIcon />,
        Component: SignIn
    },
    {
        id: "signup",
        name: "SIGN_UP_NAME",
        icon: <CreateIcon />,
        Component: SignUp
    }
];
