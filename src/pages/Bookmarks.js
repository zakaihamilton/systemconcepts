import { useEffect, useCallback } from "react";
import Table from "@widgets/Table";
import { useTranslations } from "@util/translations";
import { BookmarksStore as Bookmarks } from "@components/Bookmarks";
import Row from "@widgets/Row";
import StatusBar from "@widgets/StatusBar";
import { Store } from "pullstate";
import ItemMenu from "./Bookmarks/ItemMenu";
import { MainStore } from "@components/Main";
import { getPagesFromHash, usePages } from "@util/pages";
import Breadcrumbs from "@components/Breadcrumbs";
import styles from "./Bookmarks.module.scss";
import { useLocalStorage } from "@util/store";

export const BookmarksStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const BookmarksStore = new Store(BookmarksStoreDefaults);

export default function BookmarksPage() {
    const pages = usePages();
    const { bookmarks = [] } = Bookmarks.useState();
    const translations = useTranslations();
    const { viewMode = "table", mode, select } = BookmarksStore.useState();
    useLocalStorage("BookmarksStore", BookmarksStore, ["viewMode"]);

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

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            padding: false
        },
        {
            id: "locationWidget",
            title: translations.LOCATION,
            sortable: "id"
        }
    ];

    const mapper = item => {
        const breadcrumbPages = getPagesFromHash({ hash: item.id, translations, pages });
        const iconWidget = <ItemMenu item={item} store={BookmarksStore} />;

        return {
            ...item,
            iconWidget,
            nameWidget: <Row
                href={select ? undefined : item.id}
                onClick={bookmarkClick.bind(this, item)}
                icons={iconWidget}>
                {item.name}
            </Row>,
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
        />
    </>;
}
