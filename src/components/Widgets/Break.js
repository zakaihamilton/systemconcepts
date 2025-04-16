import React from "react";
import { styled } from '@mui/material/styles';
const PREFIX = 'Break';

const classes = {
    root: `${PREFIX}-root`
};

const Root = styled('div')({
    [`&.${classes.root}`]: {
        flexBasis: "100%",
        height: 0
    },
});

export default function GroupWidget() {

    return (<Root className={classes.root} />);
}
