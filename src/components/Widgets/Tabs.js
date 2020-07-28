import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

const useStyles = makeStyles({
    root: {
        flexGrow: 1
    },
    tab: {
        
    },
    panel: {
        marginTop:"1em"
    }
});


function TabPanel({ children, value, index, ...other }) {
    const classes = useStyles();
    return (
        <div
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            {...other}
        >
            {value === index && <div className={classes.panel}>
                {children}
            </div>}
        </div>
    );
}

export default function TabsWidget({ panels, state, ...props }) {
    const classes = useStyles();
    const [value, setValue] = state;

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const panelItems = panels && panels.map((panel, index) => {
        return (<TabPanel key={panel.id} value={value} index={index}>
            {panel.items}
        </TabPanel>);
    });

    const tabItems = panels && panels.map(panel => {
        return (<Tab key={panel.id} className={classes.tab} label={panel.label} />);
    });

    return (
        <div className={classes.root}>
            <Tabs value={value}
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
