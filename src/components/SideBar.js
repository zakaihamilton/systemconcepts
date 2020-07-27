import React, { useEffect } from "react";
import styles from "./SideBar/SideBar.module.scss"
import pages from "@/data/pages";
import ListWidget from "@/widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useImportMedia } from "@/util/styles";
import { MainStore } from "./Main";

export default function SideBar() {
    const isMobile = useImportMedia(im => im.lessThan('tablet'));
    const { menuViewList, direction, showSideBar } = MainStore.useState();

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
            <ListWidget onClick={closeDrawer} items={pages} viewType={menuViewList} />
        </Drawer>;
    }

    return <div className={styles.root}>
        <ListWidget items={pages} viewType={menuViewList} />
    </div>;
}
