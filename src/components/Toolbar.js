import { Divider } from "@material-ui/core";
import { useDeviceType } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';
import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import { useEffect } from "react";
import { useUnique } from "@/util/hooks";
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
    const { fullscreen } = MainStore.useState();
    const { sections } = ToolbarStore.useState();
    const translations = useTranslations();

    const toggleFullscreen = () => {
        MainStore.update(s => {
            s.fullscreen = !s.fullscreen;
        });
    };

    const items = [
        ...sections.filter(section => section.used).map(section => section.items).flat(),
        {
            id: "fullscreen",
            name: fullscreen ? translations.EXIT_FULLSCREEN : translations.FULLSCREEN,
            icon: fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
            onClick: toggleFullscreen,
            divider: true
        }
    ].filter(Boolean);

    if (isDesktop) {
        return <div className={styles.toolbar}>
            {items.map((item, idx) => {
                return <React.Fragment key={item.id}>
                    {item.divider && !!idx && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
                    <Tooltip arrow title={item.name}>
                        <IconButton onClick={item.onClick}>
                            {item.icon}
                        </IconButton>
                    </Tooltip>
                </React.Fragment>;
            })}
        </div>
    }

    return <Menu items={items}>
        <Tooltip arrow title={translations.MENU}>
            <IconButton>
                <MoreVertIcon />
            </IconButton>
        </Tooltip>
    </Menu>;
}
