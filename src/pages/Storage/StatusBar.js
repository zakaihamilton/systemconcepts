import React from 'react';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import { StorageStore } from "../Storage";
import { MainStore } from "@/components/Main";
import MuiAlert from '@material-ui/lab/Alert';
import { useTranslations } from "@/util/translations";
import Typography from "@material-ui/core/Typography";
import Row from "@/widgets/Row";
import SelectAllIcon from '@material-ui/icons/SelectAll';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';

export default function StatusBar({ items }) {
    const translations = useTranslations();
    const { mode, select, message, onDone, severity } = StorageStore.useState();
    const { direction } = MainStore.useState();

    const open = !!(select || message);
    const count = select && select.length;

    const onClick = async () => {
        if (onDone) {
            result = await onDone(select);
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
            messageText = translations.ITEMS_SELECTED.replace("${count}", count);
        }
        else {
            messageText = translations.ITEM_SELECTED;
        }
    }

    const selectTitle = select && select.length ? translations.SELECT_NONE : translations.SELECT_ALL;

    const selectClick = () => {
        StorageStore.update(s => {
            if (select.length) {
                s.select.length = 0;
            }
            else {
                s.select = [...items];
            }
        });
    };

    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: direction === "rtl" ? 'right' : 'left',
            }}
            open={open}
            onClose={handleClose}
        >
            <MuiAlert variant="standard" icon={<div />} onClose={handleClose} severity={severity} >
                <Row style={{ minWidth: "25em" }}>
                    {mode && <Button disabled={!count} variant="contained" onClick={onClick}>
                        {translations[mode.toUpperCase()]}
                    </Button>}
                    <Typography>
                        {messageText}
                    </Typography>
                    <div style={{ flex: 1 }} />
                    {mode && <IconButton variant="contained" onClick={selectClick}>
                        <Tooltip title={selectTitle} arrow>
                            <SelectAllIcon />
                        </Tooltip>
                    </IconButton>}
                </Row>
            </MuiAlert >
        </Snackbar >
    );
}
