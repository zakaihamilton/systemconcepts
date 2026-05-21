import PageLoad from "@components/PageLoad";
import AppsIcon from "@mui/icons-material/Apps";
import PeopleIcon from "@mui/icons-material/People";
import Apps from "@views/Apps/Apps";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";

const Users = dynamic(() => import("@views/Users/Users"), {
	loading: () => <PageLoad />,
});

const User = dynamic(() => import("@views/User/User"), {
	loading: () => <PageLoad />,
});

import SettingsIcon from "@mui/icons-material/Settings";
import { getUserSection } from "@views/User/Section";

const Settings = dynamic(() => import("@views/Settings/Settings"), {
	loading: () => <PageLoad />,
});

import LanguageIcon from "@mui/icons-material/Language";

const Languages = dynamic(() => import("@views/Languages/Languages"), {
	loading: () => <PageLoad />,
});

import TranslateIcon from "@mui/icons-material/Translate";

const Translations = dynamic(() => import("@views/Translations/Translations"), {
	loading: () => <PageLoad />,
});

import FormatSizeIcon from "@mui/icons-material/FormatSize";
import { getTranslationsSection } from "@views/Translations/Section";

const FontSizes = dynamic(() => import("@views/FontSizes/FontSizes"), {
	loading: () => <PageLoad />,
});

import StorageIcon from "@mui/icons-material/Storage";

const Storage = dynamic(() => import("@views/Storage/Storage"), {
	loading: () => <PageLoad />,
});

import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import { getStorageSection } from "@views/Storage/Section";

const Reset = dynamic(() => import("@views/Settings/Reset"), {
	loading: () => <PageLoad />,
});
const FullSync = dynamic(() => import("@views/Settings/FullSync"), {
	loading: () => <PageLoad />,
});

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

const ClearStorage = dynamic(() => import("@views/Settings/ClearStorage"), {
	loading: () => <PageLoad />,
});

import EditIcon from "@mui/icons-material/Edit";

const Editor = dynamic(() => import("@views/Editor/Editor"), {
	loading: () => <PageLoad />,
});

import ImageIcon from "@mui/icons-material/Image";

const Image = dynamic(() => import("@views/Image/Image"), {
	loading: () => <PageLoad />,
});

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { getImageSection } from "@views/Image/Section";

const Account = dynamic(() => import("@views/Account/Account"), {
	loading: () => <PageLoad />,
});

import PodcastsIcon from "@mui/icons-material/Podcasts";
import ApiIcon from "@mui/icons-material/Api";

const Podcast = dynamic(() => import("@views/Podcast/Podcast"), {
	loading: () => <PageLoad />,
});

const API = dynamic(() => import("@views/API/API"), {
	loading: () => <PageLoad />,
});

import CreateIcon from "@mui/icons-material/Create";

const SignUp = dynamic(() => import("@views/SignUp/SignUp"), {
	loading: () => <PageLoad />,
});

import VpnKeyIcon from "@mui/icons-material/VpnKey";

const ChangePassword = dynamic(
	() => import("@views/ChangePassword/ChangePassword"),
	{ loading: () => <PageLoad /> },
);

const ResetPassword = dynamic(
	() => import("@views/ResetPassword/ResetPassword"),
	{ loading: () => <PageLoad /> },
);

import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import { getResetSection } from "@views/ResetPassword/Section";

const Sessions = dynamic(() => import("@views/Sessions/Sessions"), {
	loading: () => <PageLoad />,
});

import VideoLabelIcon from "@mui/icons-material/VideoLabel";

const Player = dynamic(() => import("@views/Player/Player"), {
	loading: () => <PageLoad />,
});

import { getPlayerSection } from "@views/Player/Section";

const Session = dynamic(() => import("@views/Session/Session"), {
	loading: () => <PageLoad />,
});

import { getSessionSection } from "@views/Session/Section";

const SessionTabs = dynamic(() => import("@views/Session/Tabs"));

import EventIcon from "@mui/icons-material/Event";

const Schedule = dynamic(() => import("@views/Schedule/Schedule"), {
	loading: () => <PageLoad />,
});

import GroupWorkIcon from "@mui/icons-material/GroupWork";
import { getScheduleSection } from "@views/Schedule/Section";

const Groups = dynamic(() => import("@views/Groups/Groups"), {
	loading: () => <PageLoad />,
});

import LabelIcon from "@mui/icons-material/Label";

const Tags = dynamic(() => import("@views/Tags/Tags"), {
	loading: () => <PageLoad />,
});

import SearchIcon from "@mui/icons-material/Search";

const Research = dynamic(() => import("@views/Research"), {
	loading: () => <PageLoad />,
});

import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";

const Library = dynamic(() => import("@views/Library/Library"), {
	loading: () => <PageLoad />,
});

import BookmarkIcon from "@mui/icons-material/Bookmark";
import { getLibrarySection } from "@views/Library/Section";
import { getSessionsSection } from "@views/Sessions/Section";

const Bookmarks = dynamic(() => import("@views/Bookmarks/Bookmarks"), {
	loading: () => <PageLoad />,
});

import SyncIcon from "@mui/icons-material/Sync";

const Sync = dynamic(() => import("@views/Sync/Sync"), {
	loading: () => <PageLoad />,
});

export default [
	{
		id: "tags",
		name: "TAGS",
		Icon: LabelIcon,
		Component: Tags,
		sidebar: true,
		categoryId: "tools",
		category: "tools",
	},
	{
		id: "apps",
		name: "APPS",
		root: true,
		Icon: AppsIcon,
		Component: Apps,
		divider: true,
	},
	{
		sidebar: true,
		category: "tools",
		id: "users",
		name: "USERS",
		Icon: PeopleIcon,
		Component: Users,
		visible: () => Cookies.get("id") && Cookies.get("hash"),
	},
	{
		id: "user",
		name: "USER",
		section: getUserSection,
		Icon: PeopleIcon,
		Component: User,
	},
	{
		id: "languages",
		name: "LANGUAGES",
		Icon: LanguageIcon,
		Component: Languages,
	},
	{
		id: "translations",
		name: "TRANSLATIONS",
		section: getTranslationsSection,
		Icon: TranslateIcon,
		Component: Translations,
	},
	{
		id: "fontSizes",
		name: "FONTSIZES",
		Icon: FormatSizeIcon,
		Component: FontSizes,
	},
	{
		id: "storage",
		name: "STORAGE",
		Icon: StorageIcon,
		Component: Storage,
		section: getStorageSection,
		sidebar: true,
		category: "tools",
		contained: ["editor", "image"],
	},
	{
		sidebar: true,
		id: "settings",
		name: "SETTINGS",
		Icon: SettingsIcon,
		Component: Settings,
	},
	{
		id: "fullSync",
		name: "FULL_SYNC",
		Icon: StorageIcon,
		Component: FullSync,
	},
	{
		id: "clearStorage",
		name: "CLEAR_STORAGE",
		Icon: DeleteForeverIcon,
		Component: ClearStorage,
	},
	{
		id: "reset",
		icon: <SettingsBackupRestoreIcon />,
		Component: Reset,
	},
	{
		id: "editor",
		name: "EDITOR",
		Icon: EditIcon,
		Component: Editor,
		showTooltip: true,
	},
	{
		id: "image",
		name: "IMAGE",
		Icon: ImageIcon,
		Component: Image,
		section: getImageSection,
		showTooltip: true,
		useParentName: 1,
	},
	{
		id: "account",
		name: "ACCOUNT",
		Icon: AccountCircleIcon,
		Component: Account,
		divider: true,
		sidebar: true,
	},
	{
		id: "podcast",
		name: "PODCAST",
		Icon: PodcastsIcon,
		Component: Podcast,
		sidebar: true,
		visible: () => Cookies.get("id") && Cookies.get("hash"),
	},
	{
		id: "api",
		name: "API",
		Icon: ApiIcon,
		Component: API,
		sidebar: true,
		visible: () => Cookies.get("id") && Cookies.get("hash"),
	},
	{
		id: "signup",
		name: "SIGN_UP",
		Icon: CreateIcon,
		Component: SignUp,
	},
	{
		id: "changepassword",
		name: "CHANGE_PASSWORD",
		Icon: VpnKeyIcon,
		Component: ChangePassword,
	},
	{
		id: "resetpassword",
		name: "RESET_PASSWORD",
		Icon: VpnKeyIcon,
		Component: ResetPassword,
		section: getResetSection,
	},
	{
		apps: true,
		sidebar: true,
		id: "sessions",
		name: "SESSIONS",
		section: getSessionsSection,
		Icon: VideoLibraryIcon,
		Component: Sessions,
	},
	{
		id: "player",
		name: "PLAYER",
		Icon: VideoLabelIcon,
		section: getPlayerSection,
		Component: Player,
		useParentName: 1,
	},
	{
		apps: true,
		sidebar: true,
		id: "schedule",
		name: "SCHEDULE",
		Icon: EventIcon,
		Component: Schedule,
		section: getScheduleSection,
	},
	{
		id: "research",
		path: "research",
		name: "RESEARCH",
		custom: true,
		sidebar: true,
		apps: true,
		Icon: SearchIcon,
		Component: Research,
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
		section: getLibrarySection,
	},
	{
		id: "session",
		name: "SESSION",
		section: getSessionSection,
		Icon: VideoLabelIcon,
		Component: Session,
		tabs: SessionTabs,
	},
	{
		id: "groups",
		name: "GROUPS",
		Icon: GroupWorkIcon,
		Component: Groups,
		sidebar: true,
		category: "tools",
	},
	{
		id: "sync",
		name: "SYNC",
		Icon: SyncIcon,
		Component: Sync,
		sidebar: true,
	},
	{
		id: "manageBookmarks",
		name: "BOOKMARKS",
		sidebar: {
			name: "MANAGE",
			Icon: SettingsIcon,
		},
		Icon: BookmarkIcon,
		Component: Bookmarks,
		category: "bookmarks",
		divider: true,
	},
];
