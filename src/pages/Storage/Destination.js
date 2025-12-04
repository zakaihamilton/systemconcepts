import { forwardRef } from "react";
import { styled } from '@mui/material/styles';
import { alpha } from "@mui/material/styles";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import Slide from "@mui/material/Slide";
import { StorageStore } from "../Storage";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import StorageList from "./StorageList";
import Tooltip from "@mui/material/Tooltip";
import InputBase from "@mui/material/InputBase";

const PREFIX = 'Destination';

const classes = {
    appBar: `${PREFIX}-appBar`,
    title: `${PREFIX}-title`,
    path: `${PREFIX}-path`,
    inputRoot: `${PREFIX}-inputRoot`,
    inputInput: `${PREFIX}-inputInput`
};

const StyledDialog = styled(Dialog)((
    {
        theme
    }
) => ({
    [`& .${classes.appBar}`]: {
        position: "relative",
    },

    [`& .${classes.title}`]: {
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(4),
    },

    [`& .${classes.path}`]: {
        position: "relative",
        borderRadius: theme.shape.borderRadius,
        backgroundColor: alpha(theme.palette.common.white, 0.15),
        "&:hover": {
            backgroundColor: alpha(theme.palette.common.white, 0.25),
        },
        marginLeft: 0,
        flex: "1",
        display: "none",
        [theme.breakpoints.up("sm")]: {
            display: "flex",
        }
    },

    [`& .${classes.inputRoot}`]: {
        color: "inherit",
        width: "100%"
    },

    [`& .${classes.inputInput}`]: {
        padding: theme.spacing(1, 1, 1, 0),
        paddingLeft: "0.5em",
        paddingRight: "0.5em"
    }
}));

const Transition = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export default function Destination({ path }) {
    const translations = useTranslations();

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
                    if (item.type === "dir") {
                        await storage.moveFolder(item.path, target);
                    }
                    else {
                        await storage.moveFile(item.path, target);
                    }
                }
                catch (err) {
                    StorageStore.update(s => {
                        s.message = err;
                        s.severity = "error";
                    });
                    console.error(err);
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
                    console.error(err);
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
        (<StyledDialog fullScreen open={destination !== ""} onClose={handleClose} slots={{ transition: Transition }}>
            <AppBar className={classes.appBar}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={handleClose} size="large">
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
                {destination && <StorageList state={destinationState} />}
            </DialogContent>
        </StyledDialog>)
    );
}
