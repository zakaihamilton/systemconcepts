import React from "react";
import makeStyles from '@mui/styles/makeStyles';
import Grid from "@mui/material/Grid";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        flex: "1"
    },
    gridContainer: {
        flexGrow: 1
    },
    checkBox: {
        display: "flex",
        alignItems: "center",
        marginLeft: "1em"
    }
});

export default function GridWidget({ header, footer, children }) {
    const classes = useStyles();
    return (
        <div className={classes.root}>
            {header}
            <Grid className={classes.gridContainer} container spacing={2}>
                {children}
            </Grid>
            {footer}
        </div>
    );
}
