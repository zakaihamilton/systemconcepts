import React from "react";
import IconButton from "@/components/Widgets/IconButton";
import MenuIcon from '@material-ui/icons/Menu';
import Tooltip from '@material-ui/core/Tooltip';
import { nextTrimmedString } from "@/util/array";
import { MainStore } from "../Main";

export default function Menu() {

    const toggleMenu = () => {
        MainStore.update(s => {
            if (s.showSideBar) {
                const menuViewList = nextTrimmedString(["None", "List"], s.menuViewList);
                if (menuViewList === "None") {
                    s.menuViewList = "List";
                    s.showSideBar = false;
                }
                else {
                    s.menuViewList = menuViewList;
                }
            }
            else {
                s.showSideBar = true;
            }
        });
    };

    return <IconButton onClick={toggleMenu}>
        <Tooltip arrow title="Menu">
            <MenuIcon />
        </Tooltip>
    </IconButton>;
}
