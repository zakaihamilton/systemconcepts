import React from "react";
import styles from "./Group.module.scss";
import Typography from "@material-ui/core/Typography";

export default function GroupWidget({ border, label, children }) {
    const classes = useStyles();
    return (
        <div className={styles.root}>
            {label && <Typography variant="h6" className={styles.label}>{label}</Typography>}
            <div className={styles.container} style={{ border }}>
                {children}
            </div>
        </div>
    );
}
