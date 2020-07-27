import React from "react";
import IconButton from "@/components/Widgets/IconButton";
import AppsIcon from '@material-ui/icons/Apps';
import Tooltip from '@material-ui/core/Tooltip';
import { nextTrimmedString } from "@/util/array";
import { MainStore } from "../Main";

export default function AppIcon() {

    const toggleMenu = () => {
        MainStore.update(s => {
            if (s.showSideBar) {
                s.menuViewList = nextTrimmedString(["List", "IconList"], s.menuViewList);
            }
            else {
                s.showSideBar = true;
            }
        });
    };

    return <IconButton onClick={toggleMenu}>
        <Tooltip arrow title="Apps">
            <AppsIcon />
        </Tooltip>
    </IconButton>;
}
