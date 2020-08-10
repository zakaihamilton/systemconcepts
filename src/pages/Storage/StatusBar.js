import React from 'react';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import { StorageStore } from "../Storage";
import { MainStore } from "@/components/Main";
import MuiAlert from '@material-ui/lab/Alert';
import { useTranslations } from "@/util/translations";
import Typography from "@material-ui/core/Typography";
import Row from "@/widgets/Row";
import storage from "@/util/storage";

export default function StatusBar() {
    const translations = useTranslations();
    const { select } = StorageStore.useState();
    const { direction } = MainStore.useState();

    const open = select !== null;
    const count = select && select.length;

    const deleteItems = async () => {
        for (const item of select) {
            if (item.type === "dir") {
                await storage.deleteFolder(item.path);
            }
            else {
                await storage.deleteFile(item.path);
            }
        }
        StorageStore.update(s => {
            s.counter++;
            s.select = null;
        });
    };

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }

        StorageStore.update(s => {
            s.select = null;
        })
    };

    let message = "";
    if (!count) {
        message = translations.ITEMS_NONE_SELECTED;
    }
    else if (count > 1) {
        message = translations.ITEMS_SELECTED.replace("${count}", count);
    }
    else {
        message = translations.ITEM_SELECTED;
    }

    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: direction === "rtl" ? 'right' : 'left',
            }}
            open={open}
            onClose={handleClose}
        >
            <MuiAlert variant="standard" icon={<div />} onClose={handleClose} severity="error" >
                <Row>
                    <Button disabled={!count} variant="contained" size="small" onClick={deleteItems}>
                        {translations.DELETE}
                    </Button>
                    <Typography>
                        {message}
                    </Typography>
                </Row>
            </MuiAlert >
        </Snackbar >
    );
}
