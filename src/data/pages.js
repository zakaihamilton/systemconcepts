import AppsIcon from '@material-ui/icons/Apps';
import Apps from "@/pages/Apps";

import PeopleIcon from '@material-ui/icons/People';
import Users from "@/pages/Users";
import User, { getUserSection } from "@/pages/User";

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

import ChangePassword from "@/pages/ChangePassword";
import ResetPassword, { getResetSection } from "@/pages/ResetPassword";

import TableChartIcon from '@material-ui/icons/TableChart';
import Diagrams from "@/pages/Diagrams";

import diagrams from "@/data/diagrams";

export default [
    {
        id: "apps",
        name: "APPS",
        root: true,
        icon: <AppsIcon />,
        Component: Apps,
        sidebar: true,
        separator: true
    },
    {
        sidebar: true,
        id: "users",
        name: "USERS",
        icon: <PeopleIcon />,
        Component: Users
    },
    {
        id: "user",
        name: "USER",
        section: getUserSection,
        icon: <PeopleIcon />,
        Component: User
    },
    {
        id: "languages",
        name: "LANGUAGES",
        icon: <LanguageIcon />,
        Component: Languages
    },
    {
        id: "translations",
        name: "TRANSLATIONS",
        icon: <TranslateIcon />,
        Component: Translations
    },
    {
        id: "fontSizes",
        name: "FONTSIZES",
        icon: <FormatSizeIcon />,
        Component: FontSizes
    },
    {
        id: "storage",
        name: "STORAGE",
        icon: <StorageIcon />,
        Component: Storage,
        section: getStorageSection,
        sidebar: true
    },
    {
        sidebar: true,
        id: "settings",
        name: "SETTINGS",
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
        name: "EDITOR",
        icon: <EditIcon />,
        Component: Editor,
        showTooltip: true
    },
    {
        id: "signin",
        name: "SIGN_IN",
        icon: <VpnKeyIcon />,
        Component: SignIn
    },
    {
        id: "signup",
        name: "SIGN_UP",
        icon: <CreateIcon />,
        Component: SignUp
    },
    {
        id: "changepassword",
        name: "CHANGE_PASSWORD",
        icon: <VpnKeyIcon />,
        Component: ChangePassword
    },
    {
        id: "resetpassword",
        name: "RESET_PASSWORD",
        icon: <VpnKeyIcon />,
        Component: ResetPassword,
        section: getResetSection
    },
    {
        sidebar: true,
        id: "diagrams",
        name: "DIAGRAMS",
        icon: <TableChartIcon />,
        Component: Diagrams
    },
    ...diagrams.map(diagram => {
        let { icon } = diagram;
        if (!icon) {
            icon = <TableChartIcon />;
        }
        return {
            ...diagram,
            icon
        };
    })
];
