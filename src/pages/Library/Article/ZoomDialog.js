import React from 'react';
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";

import DialogTitle from "@mui/material/DialogTitle";

import Box from "@mui/material/Box";

export default function ZoomDialog({ open, onClose, content, number, badgeClass, Renderer }) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
        >
            <DialogContent>
                <Box sx={{ position: 'relative', paddingRight: '48px' }}>
                    {number && <span className={badgeClass}>{number}</span>}
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
                </Box>
            </DialogContent>
        </Dialog>
    );
}
