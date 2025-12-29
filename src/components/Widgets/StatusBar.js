import React, { useState, useContext, useEffect } from "react";
import { useTranslations } from "@util/translations";
import Typography from "@mui/material/Typography";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import IndeterminateCheckBoxIcon from "@mui/icons-material/IndeterminateCheckBox";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import styles from "./StatusBar.module.scss";
import CancelIcon from "@mui/icons-material/Cancel";
import clsx from "clsx";
import ButtonSelector from "@components/Widgets/ButtonSelector";
import DeleteIcon from "@mui/icons-material/Delete";
import { setPath } from "@util/pages";
import { SyncContext } from "@components/Sync";
import Button from "@mui/material/Button";
import { Store } from "pullstate";

export const StatusBarStore = new Store({ active: 0 });

export default function StatusBar({ data, mapper, store }) {
    const syncContext = useContext(SyncContext);
    const translations = useTranslations();
    const { mode, select, message, onDone, severity = "info" } = store.useState();
    const [busy, setBusy] = useState(false);

    const open = !!(select || message);

    useEffect(() => {
        if (open) {
            StatusBarStore.update(s => {
                s.active++;
            });
        }
        return () => {
            if (open) {
                StatusBarStore.update(s => {
                    s.active--;
                });
            }
        };
    }, [open]);

    if (!open) {
        return null;
    }

    const count = select && select.length;
    const disabled = busy || !count;

    const onClick = async () => {
        let result = false;
        if (onDone) {
            setBusy(true);
            result = await onDone(select);
            setBusy(false);
        }
        if (!result) {
            store.update(s => {
                s.counter++;
                s.select = null;
                s.mode = null;
            });
        }
    };

    const handleClose = (event, reason) => {
        if (reason === "clickaway" || busy) {
            return;
        }

        store.update(s => {
            s.select = null;
            s.message = null;
            s.mode = null;
        });
    };

    let messageText = message && message.toString();
    if (mode === "sync" && syncContext.error) {
        messageText = translations.WAIT_FOR_APPROVAL;
    }

    const selectTitle = select && select.length ? translations.SELECT_NONE : translations.SELECT_ALL;
    let selectIcon = null;
    if (select && data) {
        if (!select.length) {
            selectIcon = <CheckBoxOutlineBlankIcon />;
        }
        else if (select.length === data.length) {
            selectIcon = <CheckBoxIcon />;
        }
        else {
            selectIcon = <IndeterminateCheckBoxIcon />;
        }
    }

    const selectClick = () => {
        store.update(s => {
            if (select.length) {
                s.select.length = 0;
            }
            else {
                const items = mapper ? data.map(mapper) : data;
                s.select = [...items];
            }
        });
    };

    const modeItems = (mode === "move" || mode === "copy") && [
        {
            id: "move",
            name: translations.MOVE
        },
        {
            id: "copy",
            name: translations.COPY
        }
    ];

    const setMode = (mode) => {
        store.update(s => {
            s.mode = mode;
        });
    };

    const gotoAccount = () => {
        const hash = window.location.hash;
        const currentPath = hash.startsWith("#") ? hash.substring(1) : hash;
        setPath("account?redirect=" + encodeURIComponent(currentPath));
    };

    return (
        (<div className={clsx(styles.root, styles[severity])}>
            {selectTitle && selectIcon && <Tooltip title={selectTitle} arrow>
                <IconButton variant="contained" onClick={selectClick} size="large">
                    {selectIcon}
                </IconButton>
            </Tooltip>}
            {mode === "delete" && !busy && <Tooltip title={translations[mode.toUpperCase()]} arrow>
                <IconButton variant="contained" onClick={onClick} size="large">
                    <DeleteIcon />
                </IconButton>
            </Tooltip>}
            {mode && (mode === "copy" || mode === "move") && <ButtonSelector items={modeItems} state={[mode, setMode]} disabled={disabled} variant="contained" onClick={onClick}>
                {translations[mode.toUpperCase()]}
                {modeItems && "\u2026"}
            </ButtonSelector>}
            <Typography className={styles.message}>
                {messageText}
            </Typography>
            <div style={{ flex: 1 }} />
            {mode && mode === "signin" && <Button variant="contained" onClick={gotoAccount}>
                {translations.ACCOUNT}
            </Button>}
            {!busy && <Tooltip title={translations.CLOSE} arrow>
                <IconButton variant="contained" onClick={handleClose} size="large">
                    <CancelIcon />
                </IconButton>
            </Tooltip>}
        </div >)
    );
}
