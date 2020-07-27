import React from "react";
import styles from "./SideBar/SideBar.module.scss"
import pages from "@/data/pages";
import ListWidget from "@/widgets/List";
import Drawer from '@material-ui/core/Drawer';
import { useImportMedia } from "@/util/styles";
import { MainStore } from "./Main";

export default function SideBar() {
    const isMobile = useImportMedia(im => im.lessThan('tablet'));
    const { menuViewList, direction, showSideBar } = MainStore.useState();

    const closeDrawer = () => {
        MainStore.update(s => {
            s.showSideBar = false;
        });
    };

    if (isMobile) {
        return <Drawer
            anchor={direction === 'rtl' ? 'right' : 'left'}
            open={showSideBar}
            onClose={closeDrawer}
        >
            <ListWidget items={pages} viewType={menuViewList} />
        </Drawer>;
    }

    return <div className={styles.root}>
        <ListWidget items={pages} viewType={menuViewList} />
    </div>;
}
