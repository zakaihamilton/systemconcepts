import BookmarkIcon from '@material-ui/icons/Bookmark';
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useActivePages, getPagesFromHash, usePages } from "@/util/pages";
import { MainStore } from "@/components/Main";

registerToolbar("Bookmarks");

export const BookmarksStore = new Store({
    bookmarks: []
});

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
            ...props
        }
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

    useLocalStorage("bookmarks", BookmarksStore);

    const toogleBookmark = () => {
        BookmarksStore.update(s => {
            if (bookmark) {
                s.bookmarks = s.bookmarks.filter(item => item.id !== hash);
            }
            else {
                const bookmarks = [...s.bookmarks, {
                    id: window.location.hash,
                    name: pages[pages.length - 1 - (activePage.useParentName || 0)].name,
                    pageId: activePage.id
                }];
                bookmarks.sort((a, b) => a.name.localeCompare(b.name));
                s.bookmarks = bookmarks;
            }
        });
    };

    const allowBookmark = !activePage.sidebar && !activePage.root;

    const menuItems = [
        allowBookmark && {
            id: "bookmark",
            name: bookmark ? translations.REMOVE_BOOKMARK : translations.ADD_BOOKMARK,
            icon: <BookmarkIcon />,
            active: bookmark,
            onClick: toogleBookmark
        }
    ].filter(Boolean);

    useToolbar({ id: "Bookmarks", items: menuItems, depends: [activePage, bookmarks] });
    return null;
}
