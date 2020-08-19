import React from 'react';
import SpeedDial from '@material-ui/lab/SpeedDial';
import SpeedDialIcon from '@material-ui/lab/SpeedDialIcon';
import SpeedDialAction from '@material-ui/lab/SpeedDialAction';
import { MainStore } from "@/components/Main";
import styles from "./SpeedDial.module.scss";

export default function SpeedDialWidget({ visible = true, items }) {
    const { direction } = MainStore.useState();
    const [open, setOpen] = React.useState(false);

    const handleOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const speedDialItems = items.map(item => {
        const { onClick } = item;
        const itemHandler = event => {
            event.target = { ...event.target };
            event.target.value = item.id;
            onClick && onClick(event);
            handleClose();
        };
        return <SpeedDialAction
            key={item.id}
            icon={item.icon}
            tooltipTitle={item.name}
            tooltipOpen
            tooltipPlacement={direction === "rtl" ? "right" : "left"}
            onClick={itemHandler}
            classes={{
                fab: styles.icon,
                staticTooltipLabel: styles.tooltip
            }}
        />;
    });

    return (
        <SpeedDial
            ariaLabel=""
            classes={{
                root: direction === "rtl" ? styles.speedDialRtl : styles.speedDial,
                fab: styles.fab
            }}
            hidden={!visible}
            icon={<SpeedDialIcon classes={{ root: styles.fab }} />}
            onClose={handleClose}
            onOpen={handleOpen}
            open={open}
        >
            {speedDialItems}
        </SpeedDial>
    );
}
