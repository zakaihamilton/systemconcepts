import BookmarkIcon from "@mui/icons-material/Bookmark";
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { Store } from "pullstate";
import { useActivePages, getPagesFromHash, usePages } from "@util/pages";
import { MainStore } from "@components/Main";
import storage from "@storage/local";
import { LOCAL_PERSONAL_PATH } from "@personal/constants";
import { makePath } from "@util/path";
import { useEffect } from "react";

registerToolbar("Bookmarks");

export const BookmarksStore = new Store({
    bookmarks: []
});

const BOOKMARKS_PATH = makePath(LOCAL_PERSONAL_PATH, "bookmarks.json");

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
                    BookmarksStore.update(s => {
                        Object.assign(s, data);
                        s._loaded = true;
                    });
                } catch (err) {
                    console.error("Failed to parse bookmarks file", err);
                    BookmarksStore.update(s => {
                        s._loaded = true;
                    });
                }
            } else {
                const localData = typeof window !== "undefined" ? window.localStorage.getItem("bookmarks") : null;
                if (localData) {
                    try {
                        const data = JSON.parse(localData);
                        await storage.createFolderPath(BOOKMARKS_PATH);
                        await storage.writeFile(BOOKMARKS_PATH, JSON.stringify(data, null, 4));
                        BookmarksStore.update(s => {
                            Object.assign(s, data);
                            s._loaded = true;
                        });
                    } catch (err) {
                        console.error("Failed to migrate bookmarks", err);
                        BookmarksStore.update(s => {
                            s._loaded = true;
                        });
                    }
                } else {
                    BookmarksStore.update(s => {
                        s._loaded = true;
                    });
                }
            }
        };
        init();
    }, []);

    useEffect(() => {
        const unsubscribe = BookmarksStore.subscribe(s => s, async s => {
            if (s._loaded) {
                const content = JSON.stringify(s, (key, value) => {
                    if (key === "_loaded") {
                        return undefined;
                    }
                    return value;
                }, 4);
                try {
                    await storage.createFolderPath(BOOKMARKS_PATH);
                    await storage.writeFile(BOOKMARKS_PATH, content);
                } catch (err) {
                    console.error("Failed to save bookmarks", err);
                }
            }
        });
        return unsubscribe;
    }, []);
}

export function useBookmarks() {
    const translations = useTranslations();
    const { bookmarks = [] } = BookmarksStore.useState();
    const pages = usePages();
    const items = bookmarks.map(bookmark => {
        const { pageId, ...props } = bookmark;
        const pagesFromHash = getPagesFromHash({ hash: bookmark.id, translations, pages });
        const page = pagesFromHash[pagesFromHash.length - 1];
        return {
            ...page,
            target: props.id,
            ...props
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
    const bookmark = bookmarks.find(item => item.id === hash);

    useBookmarksStorage();

    const toogleBookmark = () => {
        BookmarksStore.update(s => {
            if (bookmark) {
                s.bookmarks = s.bookmarks.filter(item => item.id !== hash);
            }
            else {
                const page = pages[pages.length - 1 - (activePage.useParentName || 0)];
                const bookmarks = [...s.bookmarks, {
                    id: window.location.hash,
                    name: page.label || page.name,
                    pageId: activePage.id
                }];
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
            onClick: toogleBookmark
        }
    ].filter(Boolean);

    useToolbar({ id: "Bookmarks", items: toolbarItems, depends: [activePage, bookmarks] });
    return null;
}
