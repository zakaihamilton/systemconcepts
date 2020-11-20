import dynamic from 'next/dynamic'
import Cookies from 'js-cookie';
import PageLoad from "@components/PageLoad";

import AppsIcon from '@material-ui/icons/Apps';
import Apps from "@pages/Apps";

import PeopleIcon from '@material-ui/icons/People';
const Users = dynamic(() => import("@pages/Users"), { loading: () => <PageLoad /> });

const User = dynamic(() => import("@pages/User"), { loading: () => <PageLoad /> });
import { getUserSection } from "@pages/User/Section";

import SettingsIcon from '@material-ui/icons/Settings';
const Settings = dynamic(() => import("@pages/Settings"), { loading: () => <PageLoad /> });

import LanguageIcon from '@material-ui/icons/Language';
const Languages = dynamic(() => import("@pages/Languages"), { loading: () => <PageLoad /> });

import TranslateIcon from '@material-ui/icons/Translate';
const Translations = dynamic(() => import("@pages/Translations"), { loading: () => <PageLoad /> });
import { getTranslationsSection } from "@pages/Translations/Section";

import FormatSizeIcon from '@material-ui/icons/FormatSize';
const FontSizes = dynamic(() => import("@pages/FontSizes"), { loading: () => <PageLoad /> });

import StorageIcon from '@material-ui/icons/Storage';
const Storage = dynamic(() => import("@pages/Storage"), { loading: () => <PageLoad /> });
import { getStorageSection } from "@pages/Storage/Section";

import SettingsBackupRestoreIcon from '@material-ui/icons/SettingsBackupRestore';
const Reset = dynamic(() => import("@pages/Settings/Reset"), { loading: () => <PageLoad /> });

import EditIcon from '@material-ui/icons/Edit';
const Editor = dynamic(() => import("@pages/Editor"), { loading: () => <PageLoad /> });

import ImageIcon from '@material-ui/icons/Image';
const Image = dynamic(() => import("@pages/Image"), { loading: () => <PageLoad /> });
import { getImageSection } from "@pages/Image/Section";

import AccountCircleIcon from '@material-ui/icons/AccountCircle';
const Account = dynamic(() => import("@pages/Account"), { loading: () => <PageLoad /> });

import CreateIcon from '@material-ui/icons/Create';
const SignUp = dynamic(() => import("@pages/SignUp"), { loading: () => <PageLoad /> });

import VpnKeyIcon from '@material-ui/icons/VpnKey';
const ChangePassword = dynamic(() => import("@pages/ChangePassword"), { loading: () => <PageLoad /> });

const ResetPassword = dynamic(() => import("@pages/ResetPassword"), { loading: () => <PageLoad /> });
import { getResetSection } from "@pages/ResetPassword/Section";

import TableChartIcon from '@material-ui/icons/TableChart';
const Diagrams = dynamic(() => import("@pages/Diagrams"), { loading: () => <PageLoad /> });

import LabelIcon from '@material-ui/icons/Label';
const Terms = dynamic(() => import("@pages/Terms"), { loading: () => <PageLoad /> });

import VideoLibraryIcon from '@material-ui/icons/VideoLibrary';
const Sessions = dynamic(() => import("@pages/Sessions"), { loading: () => <PageLoad /> });

import VideoLabelIcon from '@material-ui/icons/VideoLabel';
const Player = dynamic(() => import("@pages/Player"), { loading: () => <PageLoad /> });
import { getPlayerSection } from "@pages/Player/Section";

const Session = dynamic(() => import("@pages/Session"), { loading: () => <PageLoad /> });
import { getSessionSection } from "@pages/Session/Section";
const SessionTabs = dynamic(() => import("@pages/Session/Tabs"));

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

const Tag = dynamic(() => import("@pages/Tag"), { loading: () => <PageLoad /> });
import { getTagSection } from "@pages/Tag/Section";

import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
const Librarian = dynamic(() => import("@pages/Librarian"), { loading: () => <PageLoad /> });
const LibrarianTabs = dynamic(() => import("@pages/Librarian/Tabs"));

import DescriptionIcon from '@material-ui/icons/Description';
const Content = dynamic(() => import("@pages/Content"), { loading: () => <PageLoad /> });
import { getContentSection } from "@pages/Content/Section";

import StyleIcon from '@material-ui/icons/Style';
const Types = dynamic(() => import("@pages/Types"), { loading: () => <PageLoad /> });

const Type = dynamic(() => import("@pages/Type"), { loading: () => <PageLoad /> });
import { getTypeSection } from "@pages/Type/Section";

const Articles = dynamic(() => import("@pages/Articles"), { loading: () => <PageLoad /> });

const Article = dynamic(() => import("@pages/Article"), { loading: () => <PageLoad /> });
import { getArticleSection } from "@pages/Article/Section";

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
    },
    {
        id: "timestamps",
        name: "TIMESTAMPS",
        Icon: AccessTimeIcon,
        Component: Timestamps,
        useParentName: 1
    },
    {
        id: "tags",
        name: "TAGS",
        Icon: LocalOfferIcon,
        Component: Tags
    },
    {
        id: "tag",
        name: "TAG",
        section: getTagSection,
        Icon: LocalOfferIcon,
        Component: Tag
    },
    {
        id: "librarian",
        name: "LIBRARIAN",
        Icon: LibraryBooksIcon,
        Component: Librarian,
        category: "tools",
        sidebar: true,
        tabs: LibrarianTabs,
        path: "librarian/articles"
    },
    {
        id: "content",
        name: "CONTENT",
        section: getContentSection,
        Icon: DescriptionIcon,
        Component: Content
    },
    {
        id: "type",
        name: "TYPE",
        section: getTypeSection,
        Icon: StyleIcon,
        Component: Type
    },
    {
        id: "types",
        name: "TYPES",
        Icon: StyleIcon,
        Component: Types
    },
    {
        id: "article",
        name: "ARTICLE",
        section: getArticleSection,
        Icon: StyleIcon,
        Component: Article
    },
    {
        id: "articles",
        name: "ARTICLES",
        Icon: StyleIcon,
        Component: Articles
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
