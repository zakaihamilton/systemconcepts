import PageLoad from "@components/PageLoad";
import AccountCircleIcon from "@icons/svg/AccountCircle.svg";
import ApiIcon from "@icons/svg/Api.svg";
import AppsIcon from "@icons/svg/Apps.svg";
import BookmarkIcon from "@icons/svg/Bookmark.svg";
import CreateIcon from "@icons/svg/Create.svg";
import DeleteForeverIcon from "@icons/svg/DeleteForever.svg";
import EditIcon from "@icons/svg/Edit.svg";
import EventIcon from "@icons/svg/Event.svg";
import FormatSizeIcon from "@icons/svg/FormatSize.svg";
import GroupWorkIcon from "@icons/svg/GroupWork.svg";
import ImageIcon from "@icons/svg/Image.svg";
import LabelIcon from "@icons/svg/Label.svg";
import LanguageIcon from "@icons/svg/Language.svg";
import LibraryBooksIcon from "@icons/svg/LibraryBooks.svg";
import PeopleIcon from "@icons/svg/People.svg";
import PodcastsIcon from "@icons/svg/Podcasts.svg";
import SearchIcon from "@icons/svg/Search.svg";
import SettingsIcon from "@icons/svg/Settings.svg";
import SettingsBackupRestoreIcon from "@icons/svg/SettingsBackupRestore.svg";
import StorageIcon from "@icons/svg/Storage.svg";
import SyncIcon from "@icons/svg/Sync.svg";
import TranslateIcon from "@icons/svg/Translate.svg";
import VideoLabelIcon from "@icons/svg/VideoLabel.svg";
import VideoLibraryIcon from "@icons/svg/VideoLibrary.svg";
import VpnKeyIcon from "@icons/svg/VpnKey.svg";
import Apps from "@views/Apps/Apps";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";

const Users = dynamic(() => import("@views/Users/Users"), {
	loading: () => <PageLoad />,
});

const User = dynamic(() => import("@views/User/User"), {
	loading: () => <PageLoad />,
});

import { getUserSection } from "@views/User/Section";

const Settings = dynamic(() => import("@views/Settings/Settings"), {
	loading: () => <PageLoad />,
});

const Languages = dynamic(() => import("@views/Languages/Languages"), {
	loading: () => <PageLoad />,
});

const Translations = dynamic(() => import("@views/Translations/Translations"), {
	loading: () => <PageLoad />,
});

const FontSizes = dynamic(() => import("@views/FontSizes/FontSizes"), {
	loading: () => <PageLoad />,
});

import { getTranslationsSection } from "@views/Translations/Section";

const Storage = dynamic(() => import("@views/Storage/Storage"), {
	loading: () => <PageLoad />,
});

const Reset = dynamic(() => import("@views/Settings/Reset"), {
	loading: () => <PageLoad />,
});
const FullSync = dynamic(() => import("@views/Settings/FullSync"), {
	loading: () => <PageLoad />,
});

import { getStorageSection } from "@views/Storage/Section";

const ClearStorage = dynamic(() => import("@views/Settings/ClearStorage"), {
	loading: () => <PageLoad />,
});

const Editor = dynamic(() => import("@views/Editor/Editor"), {
	loading: () => <PageLoad />,
});

const Image = dynamic(() => import("@views/Image/Image"), {
	loading: () => <PageLoad />,
});

const Account = dynamic(() => import("@views/Account/Account"), {
	loading: () => <PageLoad />,
});

import { getImageSection } from "@views/Image/Section";

const Podcast = dynamic(() => import("@views/Podcast/Podcast"), {
	loading: () => <PageLoad />,
});

const API = dynamic(() => import("@views/API/API"), {
	loading: () => <PageLoad />,
});

const SignUp = dynamic(() => import("@views/SignUp/SignUp"), {
	loading: () => <PageLoad />,
});

const ChangePassword = dynamic(
	() => import("@views/ChangePassword/ChangePassword"),
	{ loading: () => <PageLoad /> },
);

const ResetPassword = dynamic(
	() => import("@views/ResetPassword/ResetPassword"),
	{ loading: () => <PageLoad /> },
);

const Sessions = dynamic(() => import("@views/Sessions/Sessions"), {
	loading: () => <PageLoad />,
});

import { getResetSection } from "@views/ResetPassword/Section";

const Player = dynamic(() => import("@views/Player/Player"), {
	loading: () => <PageLoad />,
});

import { getPlayerSection } from "@views/Player/Section";

const Session = dynamic(() => import("@views/Session/Session"), {
	loading: () => <PageLoad />,
});

import { getSessionSection } from "@views/Session/Section";

const SessionTabs = dynamic(() => import("@views/Session/Tabs"));

const Schedule = dynamic(() => import("@views/Schedule/Schedule"), {
	loading: () => <PageLoad />,
});

const Groups = dynamic(() => import("@views/Groups/Groups"), {
	loading: () => <PageLoad />,
});

import { getScheduleSection } from "@views/Schedule/Section";

const Tags = dynamic(() => import("@views/Tags/Tags"), {
	loading: () => <PageLoad />,
});

const Research = dynamic(() => import("@views/Research"), {
	loading: () => <PageLoad />,
});

const Library = dynamic(() => import("@views/Library/Library"), {
	loading: () => <PageLoad />,
});

const Bookmarks = dynamic(() => import("@views/Bookmarks/Bookmarks"), {
	loading: () => <PageLoad />,
});

import { getLibrarySection } from "@views/Library/Section";
import { getSessionsSection } from "@views/Sessions/Section";

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
