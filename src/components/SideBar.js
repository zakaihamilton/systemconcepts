import React, { useEffect, useCallback } from "react";
import styles from "./SideBar/SideBar.module.scss"
import pages from "@/data/pages";
import ListWidget from "@/widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useImportMedia } from "@/util/styles";
import { MainStore } from "./Main";
import { getPagesFromHash } from "@/util/pages";

export default function SideBar() {
    const isMobile = useImportMedia(im => im.lessThan('tablet'));
    const { menuViewList, direction, showSideBar, hash } = MainStore.useState();
    const activePages = getPagesFromHash(hash);
    const selected = activePages[activePages.length - 1].id;
    const setSelected = useCallback(id => {
        const page = pages.find(page => page.id === id);
        if (page) {
            window.location.hash = encodeURI(page.id);
        }
    }, []);
    const state = [selected, setSelected];

    useEffect(() => {
        MainStore.update(s => {
            s.showSideBar = !isMobile && menuViewList === "List";
        });
    }, [isMobile]);

    const closeDrawer = () => {
        MainStore.update(s => {
            if (isMobile) {
                s.showSideBar = false;
            }
            else {
                s.menuViewList = "List";
            }
        });
    };

    const pageItems = pages.filter(page => page.sidebar);

    if (isMobile) {
        return <Drawer
            anchor={direction === 'rtl' ? 'right' : 'left'}
            open={showSideBar}
            ModalProps={{
                keepMounted: true
            }}
            PaperProps={{
                className: styles.popupDrawer
            }}
            onClose={closeDrawer}
        >
            <ListWidget onClick={closeDrawer} items={pageItems} state={state} viewType={menuViewList} />
        </Drawer>;
    }

    return <div className={styles.root}>
        <ListWidget items={pageItems} state={state} viewType={menuViewList} />
    </div>;
}
