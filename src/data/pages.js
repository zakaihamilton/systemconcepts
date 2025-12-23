import dynamic from "next/dynamic";
import Cookies from "js-cookie";
import PageLoad from "@components/PageLoad";

import AppsIcon from "@mui/icons-material/Apps";
import Apps from "@pages/Apps";

import PeopleIcon from "@mui/icons-material/People";
const Users = dynamic(() => import("@pages/Users"), { loading: () => <PageLoad /> });

const User = dynamic(() => import("@pages/User"), { loading: () => <PageLoad /> });
import { getUserSection } from "@pages/User/Section";

import SettingsIcon from "@mui/icons-material/Settings";
const Settings = dynamic(() => import("@pages/Settings"), { loading: () => <PageLoad /> });

import LanguageIcon from "@mui/icons-material/Language";
const Languages = dynamic(() => import("@pages/Languages"), { loading: () => <PageLoad /> });

import TranslateIcon from "@mui/icons-material/Translate";
const Translations = dynamic(() => import("@pages/Translations"), { loading: () => <PageLoad /> });
import { getTranslationsSection } from "@pages/Translations/Section";

import FormatSizeIcon from "@mui/icons-material/FormatSize";
const FontSizes = dynamic(() => import("@pages/FontSizes"), { loading: () => <PageLoad /> });

import StorageIcon from "@mui/icons-material/Storage";
const Storage = dynamic(() => import("@pages/Storage"), { loading: () => <PageLoad /> });
import { getStorageSection } from "@pages/Storage/Section";

import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
const Reset = dynamic(() => import("@pages/Settings/Reset"), { loading: () => <PageLoad /> });

import EditIcon from "@mui/icons-material/Edit";
const Editor = dynamic(() => import("@pages/Editor"), { loading: () => <PageLoad /> });

import ImageIcon from "@mui/icons-material/Image";
const Image = dynamic(() => import("@pages/Image"), { loading: () => <PageLoad /> });
import { getImageSection } from "@pages/Image/Section";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
const Account = dynamic(() => import("@pages/Account"), { loading: () => <PageLoad /> });

import CreateIcon from "@mui/icons-material/Create";
const SignUp = dynamic(() => import("@pages/SignUp"), { loading: () => <PageLoad /> });

import VpnKeyIcon from "@mui/icons-material/VpnKey";
const ChangePassword = dynamic(() => import("@pages/ChangePassword"), { loading: () => <PageLoad /> });

const ResetPassword = dynamic(() => import("@pages/ResetPassword"), { loading: () => <PageLoad /> });
import { getResetSection } from "@pages/ResetPassword/Section";

import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
const Sessions = dynamic(() => import("@pages/Sessions"), { loading: () => <PageLoad /> });

import VideoLabelIcon from "@mui/icons-material/VideoLabel";
const Player = dynamic(() => import("@pages/Player"), { loading: () => <PageLoad /> });
import { getPlayerSection } from "@pages/Player/Section";

import DescriptionIcon from "@mui/icons-material/Description";
const Transcript = dynamic(() => import("@pages/Transcript"), { loading: () => <PageLoad /> });
import { getTranscriptSection } from "@pages/Transcript/Section";
const Session = dynamic(() => import("@pages/Session"), { loading: () => <PageLoad /> });
import { getSessionSection } from "@pages/Session/Section";
const SessionTabs = dynamic(() => import("@pages/Session/Tabs"));

import EventIcon from "@mui/icons-material/Event";
const Schedule = dynamic(() => import("@pages/Schedule"), { loading: () => <PageLoad /> });

import GroupWorkIcon from "@mui/icons-material/GroupWork";
const Groups = dynamic(() => import("@pages/Groups"), { loading: () => <PageLoad /> });

import BookmarkIcon from "@mui/icons-material/Bookmark";
const Bookmarks = dynamic(() => import("@pages/Bookmarks"), { loading: () => <PageLoad /> });

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
        section: getTranslationsSection,
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
        apps: true,
        sidebar: true,
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
        showTooltip: true,
        useParentName: 1
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
        id: "transcript",
        name: "TRANSCRIPT",
        Icon: DescriptionIcon,
        Component: Transcript,
        useParentName: 1,
        tabs: SessionTabs,
        section: getTranscriptSection
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
        Component: Session,
        tabs: SessionTabs
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
    }
];
