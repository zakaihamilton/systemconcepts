import React, { useState } from 'react';
import { fade, makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import Slide from '@material-ui/core/Slide';
import { StorageStore } from "../Storage";
import { useTranslations } from "@/util/translations";
import storage from "@/util/storage";
import StorageList from "./StorageList";
import Tooltip from '@material-ui/core/Tooltip';
import InputBase from '@material-ui/core/InputBase';

const useStyles = makeStyles((theme) => ({
    appBar: {
        position: 'relative',
    },
    title: {
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(4),
    },
    path: {
        position: 'relative',
        borderRadius: theme.shape.borderRadius,
        backgroundColor: fade(theme.palette.common.white, 0.15),
        '&:hover': {
            backgroundColor: fade(theme.palette.common.white, 0.25),
        },
        marginLeft: 0,
        flex: "1",
        display: 'none',
        [theme.breakpoints.up('sm')]: {
            display: 'flex',
        }
    },
    inputRoot: {
        color: 'inherit',
        width: "100%"
    },
    inputInput: {
        padding: theme.spacing(1, 1, 1, 0),
        paddingLeft: "0.5em",
        paddingRight: "0.5em"
    }
}));

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export default function Destination({ path }) {
    const translations = useTranslations();
    const classes = useStyles();
    const { destination, mode, select } = StorageStore.useState();
    const destinationState = [destination, destination => {
        StorageStore.update(s => {
            s.destination = destination;
        });
    }];

    const handleClose = (counter) => {
        StorageStore.update(s => {
            s.destination = "";
            s.mode = "";
            s.select = null;
            if (counter) {
                s.counter++;
            }
        });
    };

    const clickAction = async () => {
        for (const item of select) {
            if (mode === "move") {
                const target = [destination, item.name].filter(Boolean).join("/");
                try {
                    if (await storage.exists(target)) {
                        throw translations.ALREADY_EXISTS.replace("${name}", item.name);
                    }
                    await storage.rename(item.path, target);
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                }
            }
            else if (mode === "copy") {
                const target = [destination, item.name].filter(Boolean).join("/");
                try {
                    if (await storage.exists(target)) {
                        throw translations.ALREADY_EXISTS.replace("${name}", item.name);
                    }
                    if (item.type === "dir") {
                        await storage.copyFolder(item.path, target);
                    }
                    else {
                        await storage.copyFile(item.path, target);
                    }
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                }
            }
        }
        handleClose(true);
    };

    const modes = [
        {
            id: "move",
            name: translations.MOVE
        },
        {
            id: "copy",
            name: translations.COPY
        }
    ];

    const modeName = (modes.find(item => item.id === mode) || {}).name;
    const disableAction = destination === path;

    return (
        <Dialog fullScreen open={destination !== ""} onClose={handleClose} TransitionComponent={Transition}>
            <AppBar className={classes.appBar}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={handleClose}>
                        <Tooltip arrow title={translations.CLOSE}>
                            <CloseIcon />
                        </Tooltip>
                    </IconButton>
                    <Typography variant="h6" className={classes.title}>
                        {translations.SELECT_DESTINATION}
                    </Typography>
                    <div className={classes.path}>
                        <InputBase
                            readOnly={true}
                            value={destination}
                            classes={{
                                root: classes.inputRoot,
                                input: classes.inputInput,
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }} />
                    <Button autoFocus color="inherit" disabled={disableAction} onClick={clickAction}>
                        {modeName}
                    </Button>
                </Toolbar>
            </AppBar>
            <DialogContent dividers={true}>
                {destination && <StorageList path={path.split("/").slice(0, 1)[0]} state={destinationState} />}
            </DialogContent>
        </Dialog>
    );
}
