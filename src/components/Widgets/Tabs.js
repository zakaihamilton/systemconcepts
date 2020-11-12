import React from "react";
import Tabs from "@material-ui/core/Tabs";
import styles from "./Tabs.module.scss";

export default function TabsWidget({ state, children, ...props }) {
    const [value, setValue] = state;

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return <Tabs value={value}
        classes={{ root: styles.root }}
        centered={true}
        indicatorColor="primary"
        textColor="primary"
        variant="fullWidth"
        onChange={handleChange}
        {...props}
    >
        {children}
    </Tabs>;
}
