import React from "react";
import clsx from "clsx";
import styles from "./IconButton.module.scss";
import IconButton from '@material-ui/core/IconButton';

export default React.forwardRef(function IconButtonWidget({ children, ...props }, ref) {
    return <IconButton ref={ref} className={styles.root} {...props}>
        {children}
    </IconButton>;
});
