import React from "react";
import makeStyles from '@mui/styles/makeStyles';

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
