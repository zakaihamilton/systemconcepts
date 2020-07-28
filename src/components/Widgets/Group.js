import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        alignContent: "stretch",
        flex: "1",
        flexWrap: "wrap",
        marginBottom: "1em"
    },
    label: {
        marginLeft: "1em",
        marginBottom: "0.2em"
    },
    container: {
        borderRadius: "16px",
        padding: "1em",
        display: "flex",
        flexWrap: "wrap",
        flex: "1",
        margin:"1em"
    }
});

export default function GroupWidget({ border, label, children }) {
    const classes = useStyles();
    return (
        <div className={classes.root}>
            {label && <Typography variant="h6" className={classes.label}>{label}</Typography>}
            <div className={classes.container} style={{ border }}>
                {children}
            </div>
        </div>
    );
}
