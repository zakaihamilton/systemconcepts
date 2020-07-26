import React from "react";
import IconButton from "@/widgets/IconButton/IconButton";
import AppsIcon from '@material-ui/icons/Apps';
import { getSlot } from "@/util/slots";
import { nextTrimmedString } from "@/util/array";

export default function AppIcon() {
    const mainSlot = getSlot("main");

    const toggleMenu = () => {
        mainSlot.menu = nextTrimmedString(["NoMenu", "MenuList", "MenuIconList"], mainSlot.menu);
        mainSlot.update();
    };

    return <IconButton onClick={toggleMenu}>
        <AppsIcon />
    </IconButton>;
}
