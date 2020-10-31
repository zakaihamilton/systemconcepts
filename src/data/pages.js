import dynamic from 'next/dynamic'
import Cookies from 'js-cookie';
import PageLoad from "@components/PageLoad";

import AppsIcon from '@material-ui/icons/Apps';
import Apps from "@pages/Apps";

import PeopleIcon from '@material-ui/icons/People';
import Users from "@pages/Users";
import User, { getUserSection } from "@pages/User";

import SettingsIcon from '@material-ui/icons/Settings';
const Settings = dynamic(() => import("@pages/Settings"), { loading: () => <PageLoad /> });

import LanguageIcon from '@material-ui/icons/Language';
const Languages = dynamic(() => import("@pages/Languages"), { loading: () => <PageLoad /> });

import TranslateIcon from '@material-ui/icons/Translate';
import Translations, { getTranslationsSection } from "@pages/Translations";

import FormatSizeIcon from '@material-ui/icons/FormatSize';
const FontSizes = dynamic(() => import("@pages/FontSizes"), { loading: () => <PageLoad /> });

import StorageIcon from '@material-ui/icons/Storage';
import Storage, { getStorageSection } from "@pages/Storage";

import SettingsBackupRestoreIcon from '@material-ui/icons/SettingsBackupRestore';
const Reset = dynamic(() => import("@pages/Settings/Reset"), { loading: () => <PageLoad /> });

import EditIcon from '@material-ui/icons/Edit';
const Editor = dynamic(() => import("@pages/Editor"), { loading: () => <PageLoad /> });

import ImageIcon from '@material-ui/icons/Image';
import Image, { getImageSection } from "@pages/Image";

import AccountCircleIcon from '@material-ui/icons/AccountCircle';
const Account = dynamic(() => import("@pages/Account"), { loading: () => <PageLoad /> });

import CreateIcon from '@material-ui/icons/Create';
const SignUp = dynamic(() => import("@pages/SignUp"), { loading: () => <PageLoad /> });

import VpnKeyIcon from '@material-ui/icons/VpnKey';
const ChangePassword = dynamic(() => import("@pages/ChangePassword"), { loading: () => <PageLoad /> });
import ResetPassword, { getResetSection } from "@pages/ResetPassword";

import TableChartIcon from '@material-ui/icons/TableChart';
const Diagrams = dynamic(() => import("@pages/Diagrams"), { loading: () => <PageLoad /> });

import LabelIcon from '@material-ui/icons/Label';
const Terms = dynamic(() => import("@pages/Terms"), { loading: () => <PageLoad /> });

import VideoLibraryIcon from '@material-ui/icons/VideoLibrary';
const Sessions = dynamic(() => import("@pages/Sessions"), { loading: () => <PageLoad /> });

import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import Player, { getPlayerSection } from "@pages/Player";

import Session, { getSessionSection } from "@pages/Session";

import EventIcon from '@material-ui/icons/Event';
const Schedule = dynamic(() => import("@pages/Schedule"), { loading: () => <PageLoad /> });

import GroupWorkIcon from '@material-ui/icons/GroupWork';
const Groups = dynamic(() => import("@pages/Groups"), { loading: () => <PageLoad /> });

import BookmarkIcon from '@material-ui/icons/Bookmark';
const Bookmarks = dynamic(() => import("@pages/Bookmarks"), { loading: () => <PageLoad /> });

import AccessTimeIcon from '@material-ui/icons/AccessTime';
const Timestamps = dynamic(() => import("@pages/Player/Timestamps"), { loading: () => <PageLoad /> });

import LocalOfferIcon from '@material-ui/icons/LocalOffer';
const Tags = dynamic(() => import("@pages/Tags"), { loading: () => <PageLoad /> });

import Tag, { getTagSection } from "@pages/Tag";

import diagrams from "@data/diagrams";

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
    {
        id: "tags",
        name: "TAGS",
        Icon: LocalOfferIcon,
        Component: Tags,
        category: "tools",
        sidebar: true
    },
    {
        id: "tag",
        name: "TAG",
        section: getTagSection,
        Icon: LocalOfferIcon,
        Component: Tag
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
