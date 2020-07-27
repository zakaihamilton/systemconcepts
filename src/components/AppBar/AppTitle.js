import React from "react";
import Typography from '@material-ui/core/Typography';
import styles from "./AppTitle/AppTitle.module.scss";

export default function AppTitle() {

    return <Typography classes={{ root: styles.root }} variant="h6">
        System Concepts
        </Typography>;
}
