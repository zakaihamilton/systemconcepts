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

export const ToolbarStore = new Store({
    sections: {}
});

export function useToolbar(items, depends = []) {
    const id = useUnique();
    const { sections } = MainStore.useState();
    useEffect(() => {
        ToolbarStore.update(s => {
            s.sections = { [id]: items, sections };
        });
        return () => {
            ToolbarStore.update(s => {
                const { [id]: section, ...sections } = s.sections;
                s.sections = { ...sections };
            });
        };
    }, []);
    useEffect(() => {
        ToolbarStore.update(s => {
            const { [id]: section, ...sections } = s.sections;
            s.sections = { [id]: items, ...sections };
        });
    }, depends);
}

export default function Toolbar() {
    const { fullscreen } = MainStore.useState();
    const { sections } = ToolbarStore.useState();
    const translations = useTranslations();

    const toggleFullscreen = () => {
        MainStore.update(s => {
            s.fullscreen = !s.fullscreen;
        });
    };

    const menuItems = [
        !fullscreen && {
            id: "fullscreen",
            name: translations.FULLSCREEN,
            icon: <FullscreenIcon />,
            onClick: toggleFullscreen
        },
        fullscreen && {
            id: "exitFullscreen",
            name: translations.EXIT_FULLSCREEN,
            icon: <FullscreenExitIcon />,
            onClick: toggleFullscreen
        },
        ...Object.values(sections).flat()
    ].filter(Boolean);

    console.log("menuItems", menuItems);

    return <Menu items={menuItems}>
        <Tooltip arrow title={translations.MENU}>
            <IconButton>
                <MoreVertIcon />
            </IconButton>
        </Tooltip>
    </Menu>;
}
