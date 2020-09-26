import { Divider } from "@material-ui/core";
import { useDeviceType } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';
import { useTranslations } from "@/util/translations";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import { useEffect } from "react";
import { Store } from "pullstate";
import styles from "./Toolbar.module.scss";

export const ToolbarStore = new Store({
    sections: [],
});

export function registerToolbar(id) {
    ToolbarStore.update(s => {
        s.sections = [...s.sections, { items: [], used: 0, id }];
    });
}

export function useToolbar({ id, items, depends = [] }) {
    useEffect(() => {
        ToolbarStore.update(s => {
            const section = s.sections.find(item => item.id === id);
            if (section) {
                section.used++;
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
                section.items = items;
            }
        });
    }, depends);
}

export default function Toolbar() {
    const isDesktop = useDeviceType() === "desktop";
    const { sections } = ToolbarStore.useState();
    const translations = useTranslations();

    console.log(sections);
    const sectionItems = sections.filter(section => section.used).map(section => section.items.map((item, idx, list) => {
        item = { ...item };
        if (idx === list.length - 1) {
            item.divider = true;
        }
        return item;
    })).flat();

    const toolbarItems = sectionItems.filter(item => item && !item.menu && isDesktop);
    const menuItems = sectionItems.filter(item => item && (item.menu || !isDesktop));

    return <div className={styles.toolbar}>
        {toolbarItems.map((item, idx) => {
            return <React.Fragment key={item.id}>
                <Tooltip arrow title={item.name}>
                    <IconButton onClick={item.onClick}>
                        {item.icon}
                    </IconButton>
                </Tooltip>
                {item.divider && idx !== toolbarItems.length - 1 && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
            </React.Fragment>
        })}
        {!!menuItems.length && <>
            {items.length && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
            <Menu items={menuItems}>
                <Tooltip arrow title={translations.MENU}>
                    <IconButton>
                        <MoreVertIcon />
                    </IconButton>
                </Tooltip>
            </Menu>
        </>
        }
    </div>
}
