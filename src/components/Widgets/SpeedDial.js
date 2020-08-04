import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Backdrop from '@material-ui/core/Backdrop';
import SpeedDial from '@material-ui/lab/SpeedDial';
import SpeedDialIcon from '@material-ui/lab/SpeedDialIcon';
import SpeedDialAction from '@material-ui/lab/SpeedDialAction';

const useStyles = makeStyles((theme) => ({
    root: {
        height: 380,
        transform: 'translateZ(0px)',
        flexGrow: 1,
    },
    speedDial: {
        position: 'absolute',
        bottom: "2em",
        right: "2em"
    },
    tooltip: {
        width: "10em"
    },
    fab: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "3em",
        height: "3em"
    },
    icon: {
        width: "3.5em",
        height: "3.5em"
    }
}));

export default function SpeedDialWidget({ visible = true, items }) {
    const classes = useStyles();
    const [open, setOpen] = React.useState(false);

    const handleOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const speedDialItems = items.map(item => (
        <SpeedDialAction
            key={item.id}
            icon={item.icon}
            tooltipTitle={item.name}
            tooltipOpen
            onClick={handleClose}
            arrow
            classes={{
                fab: classes.icon,
                staticTooltipLabel: classes.tooltip
            }}
        />
    ));

    return (
        <div className={classes.root}>
            <Backdrop open={open} />
            <SpeedDial
                ariaLabel=""
                classes={{
                    root: classes.speedDial,
                    fab: classes.fab
                }}
                hidden={!visible}
                icon={<SpeedDialIcon classes={{ root: classes.fab }} />}
                onClose={handleClose}
                onOpen={handleOpen}
                open={open}
            >
                {speedDialItems}
            </SpeedDial>
        </div>
    );
}
