import { useEffect, useCallback } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { BookmarksStore as Bookmarks } from "@/components/Bookmarks";
import Label from "@/widgets/Label";
import StatusBar from "@/widgets/StatusBar";
import { Store } from "pullstate";
import Select from '@/components/Widgets/Select';
import ItemMenu from "./Bookmarks/ItemMenu";
import BookmarkIcon from '@material-ui/icons/Bookmark';
import { MainStore } from "@/components/Main";
import { getPagesFromHash, usePages } from "@/util/pages";
import Breadcrumbs from "@/components/Breadcrumbs";
import styles from "./Bookmarks.module.scss";
import { useLocalStorage } from "@/util/store";

export const BookmarksStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const BookmarksStore = new Store(BookmarksStoreDefaults);

export default function BookmarksPage() {
    const pages = usePages();
    const { bookmarks = [] } = Bookmarks.useState();
    const translations = useTranslations();
    const { viewMode, mode, select, enableItemClick } = BookmarksStore.useState();
    useLocalStorage("BookmarksStore", BookmarksStore);

    useEffect(() => {
        BookmarksStore.update(s => {
            Object.assign(s, BookmarksStoreDefaults);
        });
    }, []);

    const bookmarkClick = useCallback(item => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            BookmarksStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        MainStore.update(s => {
            s.hash = item.id;
        });
        window.location.hash = item.id;
    }, [select]);

    const onBookmarkClick = enableItemClick && bookmarkClick;

    const columns = [
        {
            id: "iconWidget",
            viewModes: {
                list: true
            }
        },
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            onSelectable: item => true,
            onClick: onBookmarkClick
        },
        {
            id: "locationWidget",
            title: translations.LOCATION,
            sortable: "id",
            icon: <BookmarkIcon />
        }
    ];

    const mapper = item => {
        const menuIcon = !select && <ItemMenu viewMode={viewMode} item={item} />;
        const selectIcon = select && <Select select={select} item={item} store={BookmarksStore} />;
        const breadcrumbPages = getPagesFromHash({ hash: item.id, translations, pages });
        const iconWidget = select ? selectIcon : menuIcon;

        return {
            ...item,
            iconWidget,
            nameWidget: viewMode === "table" ? <Label style={{ userSelect: "none" }} name={item.name} icon={iconWidget} /> : item.name,
            locationWidget: <Breadcrumbs navigateLast={true} items={breadcrumbPages.slice(0, -1)} />
        };
    };

    const statusBar = <StatusBar data={bookmarks} mapper={mapper} store={BookmarksStore} />;

    const onImport = data => {
        Bookmarks.update(s => {
            s.bookmarks = data.bookmarks;
        });
    };

    return <>
        <Table
            name="bookmarks"
            store={BookmarksStore}
            onImport={onImport}
            columns={columns}
            data={bookmarks}
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null
            }}
            refresh={() => {
                BookmarksStore.update(s => {
                    s.counter++;
                });
            }}
            mapper={mapper}
            statusBar={statusBar}
            depends={[mode, select, translations, viewMode]}
            rowHeight="6em"
            itemHeight="4em"
        />
    </>;
}
