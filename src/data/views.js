import dynamic from "next/dynamic";
import Cookies from "js-cookie";
import PageLoad from "@components/PageLoad";

import AppsIcon from "@mui/icons-material/Apps";
import Apps from "@views/Apps";

import PeopleIcon from "@mui/icons-material/People";
const Users = dynamic(() => import("@views/Users"), { loading: () => <PageLoad /> });

const User = dynamic(() => import("@views/User"), { loading: () => <PageLoad /> });
import { getUserSection } from "@views/User/Section";

import SettingsIcon from "@mui/icons-material/Settings";
const Settings = dynamic(() => import("@views/Settings"), { loading: () => <PageLoad /> });

import LanguageIcon from "@mui/icons-material/Language";
const Languages = dynamic(() => import("@views/Languages"), { loading: () => <PageLoad /> });

import TranslateIcon from "@mui/icons-material/Translate";
const Translations = dynamic(() => import("@views/Translations"), { loading: () => <PageLoad /> });
import { getTranslationsSection } from "@views/Translations/Section";

import FormatSizeIcon from "@mui/icons-material/FormatSize";
const FontSizes = dynamic(() => import("@views/FontSizes"), { loading: () => <PageLoad /> });

import StorageIcon from "@mui/icons-material/Storage";
const Storage = dynamic(() => import("@views/Storage"), { loading: () => <PageLoad /> });
import { getStorageSection } from "@views/Storage/Section";

import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
const Reset = dynamic(() => import("@views/Settings/Reset"), { loading: () => <PageLoad /> });
const FullSync = dynamic(() => import("@views/Settings/FullSync"), { loading: () => <PageLoad /> });

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
const ClearStorage = dynamic(() => import("@views/Settings/ClearStorage"), { loading: () => <PageLoad /> });

import EditIcon from "@mui/icons-material/Edit";
const Editor = dynamic(() => import("@views/Editor"), { loading: () => <PageLoad /> });

import ImageIcon from "@mui/icons-material/Image";

const Image = dynamic(() => import("@views/Image"), { loading: () => <PageLoad /> });
import { getImageSection } from "@views/Image/Section";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
const Account = dynamic(() => import("@views/Account"), { loading: () => <PageLoad /> });

import PodcastsIcon from "@mui/icons-material/Podcasts";
const Podcast = dynamic(() => import("@views/Podcast"), { loading: () => <PageLoad /> });

import CreateIcon from "@mui/icons-material/Create";
const SignUp = dynamic(() => import("@views/SignUp"), { loading: () => <PageLoad /> });

import VpnKeyIcon from "@mui/icons-material/VpnKey";
const ChangePassword = dynamic(() => import("@views/ChangePassword"), { loading: () => <PageLoad /> });

const ResetPassword = dynamic(() => import("@views/ResetPassword"), { loading: () => <PageLoad /> });
import { getResetSection } from "@views/ResetPassword/Section";

import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
const Sessions = dynamic(() => import("@views/Sessions"), { loading: () => <PageLoad /> });

import VideoLabelIcon from "@mui/icons-material/VideoLabel";
const Player = dynamic(() => import("@views/Player"), { loading: () => <PageLoad /> });
import { getPlayerSection } from "@views/Player/Section";

const Session = dynamic(() => import("@views/Session"), { loading: () => <PageLoad /> });
import { getSessionSection } from "@views/Session/Section";
const SessionTabs = dynamic(() => import("@views/Session/Tabs"));

import EventIcon from "@mui/icons-material/Event";
const Schedule = dynamic(() => import("@views/Schedule"), { loading: () => <PageLoad /> });
import { getScheduleSection } from "@views/Schedule/Section";

import GroupWorkIcon from "@mui/icons-material/GroupWork";
const Groups = dynamic(() => import("@views/Groups"), { loading: () => <PageLoad /> });

import LabelIcon from "@mui/icons-material/Label";
const Tags = dynamic(() => import("@views/Tags"), { loading: () => <PageLoad /> });

import SearchIcon from "@mui/icons-material/Search";
const Research = dynamic(() => import("@views/Research"), { loading: () => <PageLoad /> });

import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
const Library = dynamic(() => import("@views/Library"), { loading: () => <PageLoad /> });
import { getLibrarySection } from "@views/Library/Section";

import BookmarkIcon from "@mui/icons-material/Bookmark";
import { getSessionsSection } from "@views/Sessions/Section";
const Bookmarks = dynamic(() => import("@views/Bookmarks"), { loading: () => <PageLoad /> });

import SyncIcon from "@mui/icons-material/Sync";
const Sync = dynamic(() => import("@views/Sync"), { loading: () => <PageLoad /> });

export default [
    {
        id: "tags",
        name: "TAGS",
        Icon: LabelIcon,
        Component: Tags,
        sidebar: true,
        categoryId: "tools",
        category: "tools"
    },
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
        category: "tools",
        contained: ["editor", "image"]
    },
    {
        sidebar: true,
        id: "settings",
        name: "SETTINGS",
        Icon: SettingsIcon,
        Component: Settings
    },
    {
        id: "fullSync",
        name: "FULL_SYNC",
        Icon: StorageIcon,
        Component: FullSync
    },
    {
        id: "clearStorage",
        name: "CLEAR_STORAGE",
        Icon: DeleteForeverIcon,
        Component: ClearStorage
    },
    {
        id: "reset",
        icon: <SettingsBackupRestoreIcon />,
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
        divider: true,
        sidebar: true
    },
    {
        id: "podcast",
        name: "PODCAST",
        Icon: PodcastsIcon,
        Component: Podcast,
        sidebar: true,
        visible: () => Cookies.get("id") && Cookies.get("hash")
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
        sidebar: true,
        id: "sessions",
        name: "SESSIONS",
        section: getSessionsSection,
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
        sidebar: true,
        id: "schedule",
        name: "SCHEDULE",
        Icon: EventIcon,
        Component: Schedule,
        section: getScheduleSection
    },
    {
        id: "research",
        path: "research",
        name: "RESEARCH",
        custom: true,
        sidebar: true,
        apps: true,
        Icon: SearchIcon,
        Component: Research
    },
    {
        apps: true,
        sidebar: true,
        id: "library",
        custom: true,
        path: "library",
        name: "LIBRARY",
        Icon: LibraryBooksIcon,
        Component: Library,
        section: getLibrarySection
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
        id: "sync",
        name: "SYNC",
        Icon: SyncIcon,
        Component: Sync,
        sidebar: true
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
