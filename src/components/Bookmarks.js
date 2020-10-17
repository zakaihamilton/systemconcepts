import BookmarkIcon from '@material-ui/icons/Bookmark';
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { Store } from "pullstate";
import { useLocalStorage } from "@/util/store";
import { useActivePages, usePages } from "@/util/pages";
import { MainStore } from "@/components/Main";

registerToolbar("Bookmarks");

export const BookmarksStore = new Store({
    bookmarks: []
});

export function useBookmarks() {
    const { bookmarks = [] } = BookmarksStore.useState();
    const pages = usePages();
    const items = bookmarks.map(bookmark => {
        const { pageId, ...props } = bookmark;
        const page = pages.find(page => page.id === pageId);
        return {
            ...page,
            ...props
        }
    });
    return items;
}

export default function Bookmarks() {
    useLocalStorage("bookmarks", BookmarksStore);
    const { hash } = MainStore.useState();
    const { bookmarks } = BookmarksStore.useState();
    const translations = useTranslations();
    const pages = useActivePages();
    const activePage = pages[pages.length - 1];

    const bookmark = bookmarks.find(item => item.id === hash);

    const toogleBookmark = () => {
        BookmarksStore.update(s => {
            if (bookmark) {
                s.bookmarks = s.bookmarks.filter(item => item.id !== hash);
            }
            else {
                s.bookmarks = [...s.bookmarks, {
                    id: window.location.hash,
                    name: activePage.name,
                    pageId: activePage.id
                }].sort((a, b) => a.name - b.name);
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
