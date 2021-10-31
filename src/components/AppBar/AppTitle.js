import React from "react";
import Typography from "@material-ui/core/Typography";
import styles from "./AppTitle.module.scss";
import { useTranslations } from "@util/translations";

export default function AppTitle() {
    const { APP_NAME } = useTranslations();
    return <Typography classes={{ root: styles.root }} variant="body1">
        {APP_NAME}
    </Typography>;
}
