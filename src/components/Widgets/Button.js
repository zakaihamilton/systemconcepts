import React from "react";
import styles from "./Button.module.scss";
import clsx from "clsx";
import Button from '@material-ui/core/Button';

export default function ButtonWidget({ children, variant = "contained", ...props }) {
    return <Button variant={variant} {...props}>
        {children}
    </Button>;
}
