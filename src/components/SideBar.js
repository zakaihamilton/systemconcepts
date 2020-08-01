import React, { useCallback } from "react";
import styles from "./SideBar.module.scss"
import ListWidget from "@/widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useDeviceType } from "@/util/styles";
import { MainStore } from "./Main";
import { usePagesFromHash, usePages } from "@/util/pages";

export default function SideBar() {
    const isPhone = useDeviceType() === "phone";
    const { menuViewList, direction, showDrawer, hash } = MainStore.useState();
    const activePages = usePagesFromHash(hash);
    const pages = usePages();
    const selected = activePages[activePages.length - 1].id;
    const setSelected = useCallback(id => {
        const page = pages.find(page => page.id === id);
        if (page) {
            window.location.hash = encodeURI(page.id);
        }
    }, []);
    const state = [selected, setSelected];

    const closeDrawer = () => {
        MainStore.update(s => {
            s.showDrawer = false;
        });
    };

    const pageItems = pages.filter(page => page.sidebar);

    if (isPhone) {
        return <Drawer
            anchor={direction === 'rtl' ? 'right' : 'left'}
            open={showDrawer}
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
