
import Tabs from "@mui/material/Tabs";
import styles from "./Tabs.module.css";

export default function TabsWidget({ state, children, ...props }) {
    const [value, setValue] = state;

    const handleChange = (_event, newValue) => {
        setValue(newValue);
    };

    const foundValue = children && children.find(item => {
        return (item.props.value === value);
    });

    return <Tabs value={foundValue ? value : false}
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
