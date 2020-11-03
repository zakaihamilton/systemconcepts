import React from "react";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import styles from "./Tabs.module.scss";

function TabPanel({ children, value, id, ...other }) {
    return (
        <div
            hidden={value !== id}
            id={`simple-tabpanel-${id}`}
            {...other}
        >
            {value === id && <div className={styles.panel}>
                {children}
            </div>}
        </div>
    );
}

export default function TabsWidget({ panels, state, children, ...props }) {
    const [value, setValue] = state;
    const index = panels.findIndex(item => item.id === value);

    const handleChange = (event, newValue) => {
        const id = panels[newValue].id;
        setValue(id);
    };

    const panelItems = panels && panels.map((panel) => {
        return (<TabPanel key={panel.id} value={value} id={panel.id}>
            {children}
            {panel.items}
        </TabPanel>);
    });

    const tabItems = panels && panels.map(panel => {
        return (<Tab key={panel.id} className={styles.tab} label={panel.label} />);
    });

    return (
        <div className={styles.root}>
            <Tabs value={index}
                indicatorColor="primary"
                textColor="primary"
                onChange={handleChange}
                {...props}
            >
                {tabItems}
            </Tabs>
            {panelItems}
        </div>
    );
}
