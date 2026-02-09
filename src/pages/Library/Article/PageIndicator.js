import React from "react";
import Fade from "@mui/material/Fade";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export default function PageIndicator({ scrollInfo }) {
    return (
        <Fade in={scrollInfo.visible} timeout={1000}>
            <Paper
                elevation={4}
                className="print-hidden"
                sx={{
                    position: 'fixed',
                    top: 24,
                    right: 24,
                    zIndex: 1400,
                    px: 2,
                    py: 1,
                    borderRadius: 4,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'none'
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Page {scrollInfo.page} / {scrollInfo.total}
                </Typography>
            </Paper>
        </Fade>
    );
}
