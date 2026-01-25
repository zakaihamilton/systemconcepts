import React from "react";
import Fade from "@mui/material/Fade";
import Paper from "@mui/material/Paper";
import styles from "./Research.module.scss";

const PageIndicator = React.memo(({ current, total, visible, translations, label }) => {
    return (
        <Fade in={visible} timeout={1000}>
            <Paper
                elevation={4}
                className={["print-hidden", styles.pageIndicator].join(" ")}
            >
                <div className={styles.pageIndicatorText}>
                    {label || translations.PAGE || "Page"} {current} / {total}
                </div>
            </Paper>
        </Fade>
    );
});
PageIndicator.displayName = "PageIndicator";

export default PageIndicator;
