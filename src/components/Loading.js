import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import LinearProgress from '@material-ui/core/LinearProgress';

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        marginTop: "500px",
        backgroundColor: "red",
        width: '100%',
        height: '100%'
    }
});

export default function Loading() {
    const classes = useStyles();

    return (
        <div className={classes.root}>
            <LinearProgress />
        </div>
    );
}
