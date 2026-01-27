import React from "react";
import Fade from "@mui/material/Fade";
import styles from "./PageIndicator.module.scss";

const PageIndicator = React.memo(({ current, total, visible, translations, label }) => {
    return (
        <Fade in={visible} timeout={1000}>
            <div
                className={["print-hidden", styles.root].join(" ")}
            >
                <div className={styles.text}>
                    {label || translations.PAGE} {current} / {total}
                </div>
            </div>
        </Fade>
    );
});
PageIndicator.displayName = "PageIndicator";

export default PageIndicator;
