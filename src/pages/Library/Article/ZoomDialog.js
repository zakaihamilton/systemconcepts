import React from 'react';
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";

export default function ZoomDialog({ open, onClose, content, Renderer }) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogContent>
                <Typography
                    variant="h5"
                    component="div"
                    sx={{
                        lineHeight: 3,
                        fontSize: '1.4rem'
                    }}
                >
                    {Renderer && <Renderer>{content}</Renderer>}
                </Typography>
            </DialogContent>
        </Dialog>
    );
}
