import React, { useCallback, useState } from "react";
import styles from "./SideBar.module.scss"
import ListWidget from "@/widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useDeviceType } from "@/util/styles";
import { MainStore } from "./Main";
import { usePagesFromHash, usePages, setPath } from "@/util/pages";
import QuickAccess from "./SideBar/QuickAccess";

export default function SideBar() {
    const isPhone = useDeviceType() === "phone";
    const { menuViewList, direction, showDrawer, hash, fullscreen, showSlider } = MainStore.useState();
    const activePages = usePagesFromHash(hash);
    const pages = usePages();
    const selected = activePages[activePages.length - 1].id;
    const setSelected = useCallback(id => {
        const page = pages.find(page => page.id === id);
        if (page) {
            setPath(page.id);
        }
    }, []);
    const state = [selected, setSelected];

    const closeDrawer = () => {
        MainStore.update(s => {
            if (fullscreen || isPhone) {
                s.showSlider = false;
            }
            else {
                s.showDrawer = false;
            }
        });
    };

    const items = pages.filter(page => page.sidebar && !page.category);

    if (isPhone || fullscreen) {
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
            <ListWidget onClick={closeDrawer} items={items} state={state} viewType={menuViewList} />
            <QuickAccess closeDrawer={closeDrawer} state={state} />
        </Drawer>;
    }

    return <div className={styles.root}>
        <ListWidget items={items} state={state} viewType={menuViewList} />
        <QuickAccess closeDrawer={closeDrawer} state={state} />
    </div>;
}
