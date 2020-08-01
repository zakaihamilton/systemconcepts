import React from "react";
import IconButton from "@/components/Widgets/IconButton";
import MenuIcon from '@material-ui/icons/Menu';
import Tooltip from '@material-ui/core/Tooltip';
import { MainStore } from "../Main";
import { useDeviceType } from "@/util/styles";

export default function Menu() {
    const isPhone = useDeviceType() === "phone";

    const toggleMenu = () => {
        MainStore.update(s => {
            if (isPhone) {
                s.showDrawer = true;
            }
            else {
                s.showSideBar = !s.showSideBar;
            }
        });
    };

    return <IconButton onClick={toggleMenu}>
        <Tooltip arrow title="Menu">
            <MenuIcon />
        </Tooltip>
    </IconButton>;
}
