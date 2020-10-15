import React from "react";
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import Tooltip from '@material-ui/core/Tooltip';
import { MainStore } from "../Main";
import { useDeviceType } from "@/util/styles";
import { useTranslations } from "@/util/translations";

export default function Menu() {
    const translations = useTranslations();
    const isMobile = useDeviceType() !== "desktop";
    const { fullscreen } = MainStore.useState();

    const toggleMenu = () => {
        MainStore.update(s => {
            if (isMobile || fullscreen) {
                s.showSlider = true;
            }
            else {
                s.showSideBar = !s.showSideBar;
            }
        });
    };

    return <IconButton onClick={toggleMenu}>
        <Tooltip arrow title={translations.MENU}>
            <MenuIcon />
        </Tooltip>
    </IconButton>;
}
