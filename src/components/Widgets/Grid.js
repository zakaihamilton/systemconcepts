import React from "react";
import { styled } from '@mui/material/styles';
import Grid from "@mui/material/Grid";

const PREFIX = 'Grid';

const classes = {
    root: `${PREFIX}-root`,
    gridContainer: `${PREFIX}-gridContainer`,
    checkBox: `${PREFIX}-checkBox`
};

const Root = styled('div')({
    [`&.${classes.root}`]: {
        display: "flex",
        flexDirection: "column",
        flex: "1"
    },
    [`& .${classes.gridContainer}`]: {
        flexGrow: 1
    },
    [`& .${classes.checkBox}`]: {
        display: "flex",
        alignItems: "center",
        marginLeft: "1em"
    }
});

export default function GridWidget({ header, footer, children }) {

    return (
        (<Root className={classes.root}>
            {header}
            <Grid className={classes.gridContainer} container spacing={2}>
                {children}
            </Grid>
            {footer}
        </Root>)
    );
}
