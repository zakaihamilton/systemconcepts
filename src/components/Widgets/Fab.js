
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import styles from "./Fab.module.scss";
import clsx from "clsx";

export default function FloatingActionButtons({ onClick, title, icon, ...props }) {
    const className = clsx(styles.root, onClick && styles.visible);

    return (
        <div className={className}>
            <Tooltip arrow title={title}>
                <Fab color="primary" aria-label={title} onClick={onClick} {...props}>
                    {icon}
                </Fab>
            </Tooltip>
        </div>
    );
}
