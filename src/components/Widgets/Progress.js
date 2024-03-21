import CircularProgress from "@mui/material/CircularProgress";
import styles from "./Progress.module.scss";;
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import clsx from "clsx";

export default function Progress({ size, value, tooltip = "", fullscreen, variant, ...props }) {
    const text = typeof value !== "undefined" && `${Math.round(value)}%`;

    return (<div className={clsx(styles.root, fullscreen && styles.fullscreen)} {...props}>
        <Box position="relative" display="flex">
            <CircularProgress size={size} value={value} variant={variant} />
            <Box
                top={0}
                left={0}
                bottom={0}
                right={0}
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                {text && <Tooltip title={tooltip}>
                    <Typography variant="caption" component="div" color="textSecondary">{text}</Typography>
                </Tooltip>}
            </Box>
        </Box>
    </div>);
}
