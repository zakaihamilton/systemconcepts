import React, { useState, useContext } from 'react';
import { useTranslations } from "@/util/translations";
import Typography from "@material-ui/core/Typography";
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import IndeterminateCheckBoxIcon from '@material-ui/icons/IndeterminateCheckBox';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./StatusBar.module.scss";
import CancelIcon from '@material-ui/icons/Cancel';
import clsx from "clsx";
import ButtonSelector from "@/components/Widgets/ButtonSelector";
import DeleteIcon from '@material-ui/icons/Delete';
import { setPath } from "@/util/pages";
import { SyncContext } from "@/components/Sync";
import Button from "@material-ui/core/Button";

export default function StatusBar({ data, mapper, store }) {
    const syncContext = useContext(SyncContext);
    const translations = useTranslations();
    const { mode, select, message, onDone, severity = "info" } = store.useState();
    const [busy, setBusy] = useState(false);

    const open = !!(select || message);

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
        if (reason === 'clickaway' || busy) {
            return;
        }

        store.update(s => {
            s.select = null;
            s.message = null;
            s.mode = null;
        })
    };

    let messageText = message && message.toString();

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

    const modeItems = mode !== "delete" && mode !== "signin" && [
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
        setPath("account");
    };

    return (
        <div className={clsx(styles.root, styles[severity])}>
            {selectTitle && selectIcon && <IconButton variant="contained" onClick={selectClick}>
                <Tooltip title={selectTitle} arrow>
                    {selectIcon}
                </Tooltip>
            </IconButton>}
            {mode === "delete" && !busy && <IconButton variant="contained" onClick={onClick}>
                <Tooltip title={translations[mode.toUpperCase()]} arrow>
                    <DeleteIcon />
                </Tooltip>
            </IconButton>}
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
            {mode && mode === "fullsync" && <Button variant="contained" disabled={!syncContext.fullSync} onClick={syncContext.fullSync}>
                {translations.FULL_SYNC}
            </Button>}
            {!busy && <IconButton variant="contained" onClick={handleClose}>
                <Tooltip title={translations.CLOSE} arrow>
                    <CancelIcon />
                </Tooltip>
            </IconButton>}
        </div >
    );
}
