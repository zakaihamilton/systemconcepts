import React from 'react';
import Button from '@material-ui/core/Button';
import { StorageStore } from "../Storage";
import { useTranslations } from "@/util/translations";
import Typography from "@material-ui/core/Typography";
import SelectAllIcon from '@material-ui/icons/SelectAll';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import styles from "./StatusBar.module.scss";
import CancelIcon from '@material-ui/icons/Cancel';
import clsx from "clsx";
import Destination from "./Destination";

export default function StatusBar({ data, mapper }) {
    const translations = useTranslations();
    const { mode, select, message, onDone, severity, destination } = StorageStore.useState();

    const open = !!(select || message);

    if (!open) {
        return null;
    }

    const count = select && select.length;

    const onClick = async () => {
        if (onDone) {
            await onDone(select);
        }
        StorageStore.update(s => {
            s.counter++;
            s.select = null;
            s.mode = null;
        });
    };

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }

        StorageStore.update(s => {
            s.select = null;
            s.message = null;
            s.mode = null;
        })
    };

    let messageText = message && message.toString();
    if (!message && select) {
        if (!count) {
            messageText = translations.ITEMS_NONE_SELECTED;
        }
        else if (count > 1) {
            messageText = translations.SELECTED_ITEMS.replace("${count}", count);
        }
        else {
            messageText = translations.SELECTED_ITEM;
        }
    }

    const selectTitle = select && select.length ? translations.SELECT_NONE : translations.SELECT_ALL;

    const selectClick = () => {
        StorageStore.update(s => {
            if (select.length) {
                s.select.length = 0;
            }
            else {
                const items = mapper ? data.map(mapper) : data;
                s.select = [...items];
            }
        });
    };

    const showDestination = mode === "copy" || mode == "move";

    const setDestination = (destination) => {
        StorageStore.update(s => {
            s.destination = destination;
        });
    };

    const actionDisabled = !count || (showDestination && !destination);

    return (
        <div className={clsx(styles.root, styles[severity])}>
            {mode && <Button disabled={actionDisabled} variant="contained" onClick={onClick}>
                {translations[mode.toUpperCase()]}
            </Button>}
            <Typography className={styles.message}>
                {messageText}
            </Typography>
            {mode && <IconButton variant="contained" onClick={selectClick}>
                <Tooltip title={selectTitle} arrow>
                    <SelectAllIcon />
                </Tooltip>
            </IconButton>}
            {showDestination && <Destination state={[destination, setDestination]} />}
            <IconButton variant="contained" onClick={handleClose}>
                <Tooltip title={translations.CLOSE} arrow>
                    <CancelIcon />
                </Tooltip>
            </IconButton>
        </div>
    );
}
