import React from "react";
import Popover from "@material-ui/core/Popover";

export default function SimplePopover({ anchorEl, setAnchorEl, children, ...props }) {

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? "simple-popover" : undefined;

    return (
        <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: "center"
            }}
            transformOrigin={{
                vertical: "top",
                horizontal: "center"
            }}
            {...props}
        >
            {children}
        </Popover>
    );
}
