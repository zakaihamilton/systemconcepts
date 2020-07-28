import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
    root: {
        flexBasis: "100%",
        height: 0
    },
});

export default function GroupWidget() {
    const classes = useStyles();
    return (
        <div className={classes.root} />
    );
}
