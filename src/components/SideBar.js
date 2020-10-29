import React, { useCallback } from "react";
import styles from "./SideBar.module.scss"
import List from "@widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useDeviceType } from "@util/styles";
import { MainStore } from "./Main";
import { useActivePages, usePages, setPath } from "@util/pages";
import QuickAccess from "./SideBar/QuickAccess";
import { useBookmarks } from "@components/Bookmarks";
import BookmarkIcon from '@material-ui/icons/Bookmark';
import { useTranslations } from "@util/translations";

export default function SideBar() {
    const translations = useTranslations();
    const isMobile = useDeviceType() !== "desktop";
    const { direction, showSlider } = MainStore.useState();
    const bookmarks = useBookmarks();
    const activePages = useActivePages();
    const pages = usePages("sidebar");
    const selected = id => {
        return !!activePages.find(page => page.id === id && !page.sectionIndex);
    };
    const setSelected = useCallback(id => {
        const page = pages.find(page => page.id === id);
        if (page) {
            setPath(page.id);
        }
        else {
            MainStore.update(s => {
                s.hash = id;
            });
            window.location.hash = id;
        }
    }, []);
    const state = [selected, setSelected];

    const closeDrawer = () => {
        MainStore.update(s => {
            if (isMobile) {
                s.showSlider = false;
            }
            else {
                s.showDrawer = false;
            }
        });
    };

    const items = pages.filter(page => page.sidebar && !page.category);
    items.push({
        id: "bookmarks",
        name: translations.BOOKMARKS,
        icon: <BookmarkIcon />,
        items: [
            ...pages.filter(page => page.sidebar && page.category === "bookmarks"),
            ...bookmarks],
        divider: true
    });

    if (isMobile) {
        return <Drawer
            anchor={direction === 'rtl' ? 'right' : 'left'}
            open={showSlider}
            ModalProps={{
                keepMounted: true
            }}
            PaperProps={{
                className: styles.popupDrawer
            }}
            onClose={closeDrawer}
        >
            <List onClick={closeDrawer} items={items} state={state} />
            <QuickAccess closeDrawer={closeDrawer} state={state} />
        </Drawer>;
    }

    return <div className={styles.root}>
        <List items={items} state={state} />
        <QuickAccess closeDrawer={closeDrawer} state={state} />
    </div>;
}
