import Cookies from 'js-cookie';

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

import UpdateIcon from "@material-ui/icons/Update";
import UpdateSessions from "@/pages/UpdateSessions";

import SettingsBackupRestoreIcon from '@material-ui/icons/SettingsBackupRestore';
import Reset from "@/pages/Settings/Reset";

import EditIcon from '@material-ui/icons/Edit';
import Editor from "@/pages/Editor";

import ImageIcon from '@material-ui/icons/Image';
import Image, { getImageSection } from "@/pages/Image";

import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import Account from "@/pages/Account";

import CreateIcon from '@material-ui/icons/Create';
import SignUp from "@/pages/SignUp";

import VpnKeyIcon from '@material-ui/icons/VpnKey';
import ChangePassword from "@/pages/ChangePassword";
import ResetPassword, { getResetSection } from "@/pages/ResetPassword";

import TableChartIcon from '@material-ui/icons/TableChart';
import Diagrams from "@/pages/Diagrams";

import LabelIcon from '@material-ui/icons/Label';
import Terms from "@/pages/Terms";

import VideoLibraryIcon from '@material-ui/icons/VideoLibrary';
import Sessions from "@/pages/Sessions";

import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import Player, { getPlayerSection } from "@/pages/Player";

import Session, { getSessionSection } from "@/pages/Session";

import EventIcon from '@material-ui/icons/Event';
import Schedule from "@/pages/Schedule";

import GroupWorkIcon from '@material-ui/icons/GroupWork';
import Groups from "@/pages/Groups";

import BookmarkIcon from '@material-ui/icons/Bookmark';
import Bookmarks from "@/pages/Bookmarks";

import AccessTimeIcon from '@material-ui/icons/AccessTime';
import Timestamps from "@/pages/Player/Timestamps";

import diagrams from "@/data/diagrams";

export default [
    {
        id: "apps",
        name: "APPS",
        root: true,
        Icon: AppsIcon,
        Component: Apps,
        divider: true
    },
    {
        sidebar: true,
        category: "tools",
        id: "users",
        name: "USERS",
        Icon: PeopleIcon,
        Component: Users,
        visible: () => Cookies.get("id") && Cookies.get("hash")
    },
    {
        id: "user",
        name: "USER",
        section: getUserSection,
        Icon: PeopleIcon,
        Component: User
    },
    {
        id: "languages",
        name: "LANGUAGES",
        Icon: LanguageIcon,
        Component: Languages
    },
    {
        id: "translations",
        name: "TRANSLATIONS",
        Icon: TranslateIcon,
        Component: Translations
    },
    {
        id: "fontSizes",
        name: "FONTSIZES",
        Icon: FormatSizeIcon,
        Component: FontSizes
    },
    {
        id: "storage",
        name: "STORAGE",
        Icon: StorageIcon,
        Component: Storage,
        section: getStorageSection,
        sidebar: true,
        category: "tools"
    },
    {
        id: "update_sessions",
        name: "UPDATE_SESSIONS",
        Icon: UpdateIcon,
        Component: UpdateSessions,
        sidebar: true,
        category: "tools"
    },
    {
        apps: true,
        id: "settings",
        name: "SETTINGS",
        Icon: SettingsIcon,
        Component: Settings
    },
    {
        id: "settings/reset",
        name: "RESET",
        Icon: SettingsBackupRestoreIcon,
        Component: Reset
    },
    {
        id: "editor",
        name: "EDITOR",
        Icon: EditIcon,
        Component: Editor,
        showTooltip: true
    },
    {
        id: "image",
        name: "IMAGE",
        Icon: ImageIcon,
        Component: Image,
        section: getImageSection,
        showTooltip: true
    },
    {
        id: "account",
        name: "ACCOUNT",
        Icon: AccountCircleIcon,
        Component: Account,
        sidebar: true
    },
    {
        id: "signup",
        name: "SIGN_UP",
        Icon: CreateIcon,
        Component: SignUp
    },
    {
        id: "changepassword",
        name: "CHANGE_PASSWORD",
        Icon: VpnKeyIcon,
        Component: ChangePassword
    },
    {
        id: "resetpassword",
        name: "RESET_PASSWORD",
        Icon: VpnKeyIcon,
        Component: ResetPassword,
        section: getResetSection
    },
    {
        apps: true,
        id: "diagrams",
        name: "DIAGRAMS",
        Icon: TableChartIcon,
        Component: Diagrams
    },
    {
        apps: true,
        id: "terms",
        name: "TERMS",
        Icon: LabelIcon,
        Component: Terms
    },
    {
        apps: true,
        id: "sessions",
        name: "SESSIONS",
        Icon: VideoLibraryIcon,
        Component: Sessions
    },
    {
        id: "player",
        name: "PLAYER",
        Icon: VideoLabelIcon,
        section: getPlayerSection,
        Component: Player,
        useParentName: 1
    },
    {
        apps: true,
        id: "schedule",
        name: "SCHEDULE",
        Icon: EventIcon,
        Component: Schedule
    },
    {
        id: "session",
        name: "SESSION",
        section: getSessionSection,
        Icon: VideoLabelIcon,
        Component: Session
    },
    {
        id: "groups",
        name: "GROUPS",
        Icon: GroupWorkIcon,
        Component: Groups,
        sidebar: true,
        category: "tools"
    },
    {
        id: "manageBookmarks",
        name: "BOOKMARKS",
        sidebar: {
            name: "MANAGE",
            Icon: SettingsIcon
        },
        Icon: BookmarkIcon,
        Component: Bookmarks,
        category: "bookmarks",
        divider: true
    },
    {
        id: "timestamps",
        name: "TIMESTAMPS",
        Icon: AccessTimeIcon,
        Component: Timestamps,
        useParentName: 2
    },
    ...diagrams.map(diagram => {
        let { Icon } = diagram;
        if (!Icon) {
            Icon = TableChartIcon;
        }
        return {
            ...diagram,
            tooltip: "DIAGRAM",
            Icon
        };
    })
];
