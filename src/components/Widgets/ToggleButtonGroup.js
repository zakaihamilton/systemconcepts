import React from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import Tooltip from "@material-ui/core/Tooltip";
import styles from "./ToggleButtonGroup.module.scss";

export default function ToggleButtonGroupWidget({ items, state, ...props }) {
    const [selected, setSelected] = state;

    const handleSelected = (event, selected) => {
        if (selected) {
            setSelected(selected);
        }
    };

    const buttonItems = items.map(button => {
        const { icon, id, name, ...props } = button;
        const title = icon && name || "";
        return (
            <Tooltip key={id} title={title} arrow>
                <ToggleButton selected={selected === id} value={id} {...props}>
                    {icon || name}
                </ToggleButton>
            </Tooltip>
        );
    });

    return (
        <ToggleButtonGroup
            className={styles.root}
            value={selected}
            exclusive
            onChange={handleSelected}
            {...props}
        >
            {buttonItems}
        </ToggleButtonGroup>
    );
}
