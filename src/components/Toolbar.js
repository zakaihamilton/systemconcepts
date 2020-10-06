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

export const ToolbarStore = new Store({
    sections: [],
});

export function registerToolbar(id) {
    ToolbarStore.update(s => {
        s.sections = [...s.sections, { items: [], used: 0, id }];
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
    }, depends);
}

export default function Toolbar({ location, divider, collapsable }) {
    const isDesktop = useDeviceType() === "desktop";
    const { sections } = ToolbarStore.useState();
    const translations = useTranslations();

    let sectionItems = sections.filter(section => section.used && section.visible).map(section => section.items.map((item, idx, list) => {
        item = { ...item };
        if (idx === list.length - 1) {
            item.divider = true;
        }
        return item;
    })).flat();

    sectionItems = sectionItems.filter(item => item.location === location);
    const toolbarItems = sectionItems.filter(item => item && !item.menu && (isDesktop || !collapsable));
    const menuItems = sectionItems.filter(item => item && (item.menu || (!isDesktop && collapsable)));

    return <div className={styles.toolbar}>
        {toolbarItems.map((item, idx) => {
            return <React.Fragment key={item.id}>
                {item.element}
                {!item.element && <IconButton disabled={item.disabled} onClick={item.onClick ? item.onClick : undefined}>
                    <Tooltip arrow title={item.name}>
                        {item.icon}
                    </Tooltip>
                </IconButton>}
                {item.divider && idx !== toolbarItems.length - 1 && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
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
        {divider && (toolbarItems.length || menuItems.length) && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
    </div>
}
