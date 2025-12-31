import { Divider } from "@mui/material";
import { useDeviceType } from "@util/styles";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "@util/translations";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Menu from "@widgets/Menu";
import { useEffect } from "react";
import styles from "./Toolbar.module.scss";
import { Store } from "pullstate";
import Item from "./Toolbar/Item";
import clsx from "clsx";

export const ToolbarStore = new Store({
    sections: [],
});

export function registerToolbar(id, sortKey) {
    ToolbarStore.update(s => {
        s.sections = [...s.sections, { items: [], used: 0, id, sortKey }];
    });
}

export function useToolbar({ id, items, visible = true, depends = [] }) {
    useEffect(() => {
        ToolbarStore.update(s => {
            const section = s.sections.find(item => item.id === id);
            if (section) {
                section.used++;
                section.visible = visible;
                section.items = items;
            }
        });
        return () => {
            ToolbarStore.update(s => {
                const section = s.sections.find(item => item.id === id);
                if (section) {
                    section.used--;
                }
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        ToolbarStore.update(s => {
            const section = s.sections.find(item => item.id === id);
            if (section) {
                section.visible = visible;
                section.items = items;
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...depends, visible]);
}

export function useToolbarItems({ location }) {
    const { sections } = ToolbarStore.useState();

    let toolbars = sections.filter(section => section.used && section.visible);

    toolbars.sort((a, b) => {
        const aKey = a.sortKey || 0;
        const bKey = b.sortKey || 0;
        return aKey - bKey;
    });

    let sectionItems = toolbars.map(section => section.items.filter(item => item && item.id).map((item, idx, list) => {
        item = { ...item };
        if (idx === list.length - 1) {
            item.divider = true;
        }
        return item;
    })).flat();
    sectionItems = sectionItems.filter(item => {
        if (!item) {
            return false;
        }
        if (Array.isArray(location)) {
            return location.includes(item.location) || (!item.location && location.includes(undefined));
        }
        return item.location === location || (!location && !item.location);
    });

    sectionItems.sort((a, b) => {
        const aKey = a.sortKey || 0;
        const bKey = b.sortKey || 0;
        return aKey - bKey;
    });

    return sectionItems;
}

export default function Toolbar({ className, location, dividerBefore, dividerAfter, collapsable }) {
    const isDesktop = useDeviceType() === "desktop";
    const translations = useTranslations();
    const sectionItems = useToolbarItems({ location });
    const toolbarItems = sectionItems.filter(item => {
        const { menu } = item;
        if (typeof menu === "undefined") {
            return isDesktop || !collapsable;
        }
        return !menu;
    });
    const menuItems = sectionItems.filter(item => {
        const { menu } = item;
        if (typeof menu === "undefined") {
            return !isDesktop && collapsable;
        }
        return menu;
    });

    const toolbarVisible = !!toolbarItems.length || !!menuItems.length;

    return (
        <div className={clsx(styles.toolbar, toolbarVisible && styles.visible, className)}>
            {!!dividerBefore && !!(toolbarVisible || menuItems.length) && <Divider classes={{ root: styles.divider }} orientation="vertical" flexItem />}
            {toolbarItems.map((item, idx) => (<Item key={item.id} item={item} idx={idx} count={toolbarItems.length} />))}
            {!!menuItems.length && <>
                {!!toolbarItems.length && <Divider classes={{ root: styles.divider }} orientation="vertical" flexItem />}
                <Menu items={menuItems}>
                    <Tooltip arrow title={translations.MENU}>
                        <IconButton className={styles.menuButton} size="small" aria-label={translations.MENU}>
                            <MoreVertIcon />
                        </IconButton>
                    </Tooltip>
                </Menu>
            </>
            }
            {!!dividerAfter && !!(toolbarVisible || menuItems.length) && <Divider classes={{ root: styles.divider }} orientation="vertical" flexItem />}
        </div>
    );
}

