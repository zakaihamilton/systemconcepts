import React from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import Tooltip from "@material-ui/core/Tooltip";

export default function ToggleButtonGroupWidget({ buttons, state, ...props }) {
    const [selected, setSelected] = state;

    const handleSelected = (event, selected) => {
        if (selected) {
            setSelected(selected);
        }
    };

    const buttonItems = buttons.map(button => {
        const { icon, id, title, ...props } = button;
        return (
            <Tooltip key={id} title={title} arrow>
                <ToggleButton selected={selected === id} value={id} {...props}>
                    {icon}
                </ToggleButton>
            </Tooltip>
        );
    });

    return (
        <ToggleButtonGroup
            value={selected}
            exclusive
            onChange={handleSelected}
            {...props}
        >
            {buttonItems}
        </ToggleButtonGroup>
    );
}
