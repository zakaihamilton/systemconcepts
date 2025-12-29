import React from "react";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Tooltip from "@mui/material/Tooltip";
import { MainStore } from "../Main";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";

export default function SidebarIcon() {
    const translations = useTranslations();
    const isMobile = useDeviceType() !== "desktop";

    const toggleMenu = () => {
        MainStore.update(s => {
            if (isMobile) {
                s.showSlider = true;
            }
            else {
                s.showSideBar = !s.showSideBar;
            }
        });
    };

    return (
        <Tooltip arrow title={translations.SIDEBAR}>
            <IconButton onClick={toggleMenu} size="large">
                <MenuIcon />
            </IconButton>
        </Tooltip>
    );
}
