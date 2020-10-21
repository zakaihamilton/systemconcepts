import { Divider } from "@material-ui/core";
import { useDeviceType } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';
import { useTranslations } from "@/util/translations";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import { useEffect } from "react";
import styles from "./Toolbar.module.scss";
import { Store } from "pullstate";
import Label from "@/widgets/Label";
import clsx from "clsx";
import { useStyles } from "@/util/styles";

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
    }, []);
    useEffect(() => {
        ToolbarStore.update(s => {
            const section = s.sections.find(item => item.id === id);
            if (section) {
                section.visible = visible;
                section.items = items;
            }
        });
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

    let sectionItems = toolbars.map(section => section.items.map((item, idx, list) => {
        item = { ...item };
        if (idx === list.length - 1) {
            item.divider = true;
        }
        return item;
    })).flat();
    sectionItems = sectionItems.filter(item => item && (item.location === location || (!location && !item.location)));
    return sectionItems;
}

export default function Toolbar({ className, location, dividerBefore, dividerAfter, collapsable }) {
    const isDesktop = useDeviceType() === "desktop";
    const { sections } = ToolbarStore.useState();
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

    return <div className={clsx(styles.toolbar, className)}>
        {!!dividerBefore && !!(toolbarItems.length || menuItems.length) && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
        {toolbarItems.map((item, idx) => {
            const className = useStyles(styles, {
                selected: item.selected === item.id,
                active: item.active
            });
            const showDivider = !!item.divider && idx !== toolbarItems.length - 1;
            return <React.Fragment key={item.id}>
                {item.element}
                {!item.element &&
                    <Menu items={item.items} selected={item.selected} onClick={item.onClick ? item.onClick : undefined}>
                        {!!item.label ?
                            (<Label icon={item.icon} name={item.name} noBorder={true} />) :
                            (<IconButton className={className} disabled={item.disabled}>
                                <Tooltip arrow title={item.name}>
                                    {item.icon}
                                </Tooltip>
                            </IconButton>)}
                    </Menu>
                }
                <Divider classes={{ root: clsx(styles.divider, !showDivider && styles.hidden) }} orientation="vertical" />
            </React.Fragment>
        })}
        {!!menuItems.length && <>
            {menuItems.length && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
            <Menu items={menuItems}>
                <IconButton>
                    <Tooltip arrow title={translations.MENU}>
                        <MoreVertIcon />
                    </Tooltip>
                </IconButton>
            </Menu>
        </>
        }
        {!!dividerAfter && !!(toolbarItems.length || menuItems.length) && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
    </div>
}
