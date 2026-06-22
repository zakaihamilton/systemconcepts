import { MainStore } from "@components/Main";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { SYNC_CONFIG } from "@sync/config";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import { getPagesFromHash, useActivePages, usePages } from "@util/domain/views";
import storage from "@util/storage/storage";
import { Store } from "pullstate";
import { useEffect } from "react";

registerToolbar("Bookmarks");

export const BookmarksStore = new Store({
	bookmarks: [],
});

const personalConfig = SYNC_CONFIG.find((c) => c.name === "Personal");
const LOCAL_PERSONAL_PATH = personalConfig
	? personalConfig.localPath
	: "local/personal";
const BOOKMARKS_PATH = makePath(LOCAL_PERSONAL_PATH, "bookmarks.json");

let storageSubscription = null;

function useBookmarksStorage() {
	useEffect(() => {
		const init = async () => {
			if (BookmarksStore.getRawState()._loaded) {
				return;
			}
			const exists = await storage.exists(BOOKMARKS_PATH);
			if (exists) {
				const content = await storage.readFile(BOOKMARKS_PATH);
				try {
					const data = JSON.parse(content);
					BookmarksStore.update((s) => {
						Object.assign(s, data);
						s._loaded = true;
					});
				} catch (err) {
					structuredLogger.error("Failed to parse bookmarks file", err);
					BookmarksStore.update((s) => {
						s._loaded = true;
					});
				}
			} else {
				const localData =
					typeof window !== "undefined"
						? window.localStorage.getItem("bookmarks")
						: null;
				if (localData) {
					try {
						const data = JSON.parse(localData);
						await storage.createFolderPath(BOOKMARKS_PATH);
						await storage.writeFile(
							BOOKMARKS_PATH,
							JSON.stringify(data, null, 4),
						);
						window.localStorage.removeItem("bookmarks");
						BookmarksStore.update((s) => {
							Object.assign(s, data);
							s._loaded = true;
						});
					} catch (err) {
						structuredLogger.error("Failed to migrate bookmarks", err);
						BookmarksStore.update((s) => {
							s._loaded = true;
						});
					}
				} else {
					BookmarksStore.update((s) => {
						s._loaded = true;
					});
				}
			}
		};
		init();
	}, []);

	useEffect(() => {
		if (storageSubscription) {
			return;
		}
		storageSubscription = BookmarksStore.subscribe(
			(s) => s,
			async (s) => {
				if (s._loaded) {
					const content = JSON.stringify(
						s,
						(key, value) => {
							if (key === "_loaded") {
								return undefined;
							}
							return value;
						},
						4,
					);
					try {
						await storage.createFolderPath(BOOKMARKS_PATH);
						await storage.writeFile(BOOKMARKS_PATH, content);
					} catch (err) {
						structuredLogger.error("Failed to save bookmarks", err);
					}
				}
			},
		);
		return () => {
			if (storageSubscription) {
				storageSubscription();
				storageSubscription = null;
			}
		};
	}, []);
}

export function useBookmarks() {
	useBookmarksStorage();
	const translations = useTranslations();
	const { bookmarks = [] } = BookmarksStore.useState();
	const pages = usePages();
	const items = bookmarks.map((bookmark) => {
		const { pageId: _pageId, ...props } = bookmark;
		const pagesFromHash = getPagesFromHash({
			hash: bookmark.id,
			translations,
			pages,
		});
		const page = pagesFromHash[pagesFromHash.length - 1];
		return {
			...page,
			target: props.id,
			...props,
		};
	});
	return items;
}

export default function Bookmarks() {
	const { bookmarks } = BookmarksStore.useState();
	const { hash } = MainStore.useState();
	const translations = useTranslations();
	const pages = useActivePages();
	const activePage = pages[pages.length - 1];
	const bookmark = bookmarks.find((item) => item.id === hash);

	useBookmarksStorage();

	const toggleBookmark = () => {
		BookmarksStore.update((s) => {
			if (bookmark) {
				s.bookmarks = s.bookmarks.filter((item) => item.id !== hash);
			} else {
				const page = pages[pages.length - 1 - (activePage.useParentName || 0)];
				const bookmarks = [
					...s.bookmarks,
					{
						id: window.location.hash,
						name: page.label || page.name,
						pageId: activePage.id,
					},
				];
				bookmarks.sort((a, b) => a.name.localeCompare(b.name));
				s.bookmarks = bookmarks;
			}
		});
	};

	const allowBookmark = !activePage.sidebar && !activePage.root;

	const toolbarItems = [
		allowBookmark && {
			id: "bookmark",
			name: bookmark ? translations.REMOVE_BOOKMARK : translations.ADD_BOOKMARK,
			icon: <BookmarkIcon />,
			active: bookmark,
			location: "header",
			menu: true,
			onClick: toggleBookmark,
		},
	].filter(Boolean);

	useToolbar({
		id: "Bookmarks",
		items: toolbarItems,
		depends: [activePage, bookmarks],
	});
	return null;
}
