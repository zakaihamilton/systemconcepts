import React from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Fab from "@mui/material/Fab";
import Zoom from "@mui/material/Zoom";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

export default function ScrollToTop({ show, translations, onClick }) {
    return (
        <Zoom in={show}>
            <Box
                sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    zIndex: 1300
                }}
            >
                <Tooltip title={translations.SCROLL_TO_TOP} placement="right">
                    <Fab
                        size="small"
                        aria-label="scroll back to top"
                        onClick={onClick}
                        sx={{
                            opacity: 0.6,
                            backgroundColor: 'var(--action-hover)',
                            color: 'var(--text-secondary)',
                            boxShadow: 1,
                            '&:hover': {
                                opacity: 1,
                                backgroundColor: 'var(--action-selected)'
                            }
                        }}
                    >
                        <ArrowUpwardIcon fontSize="small" />
                    </Fab>
                </Tooltip>
            </Box>
        </Zoom>
    );
}
