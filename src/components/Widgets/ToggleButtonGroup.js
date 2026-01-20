
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from "@mui/material/Tooltip";
import styles from "./ToggleButtonGroup.module.scss";

export default function ToggleButtonGroupWidget({ items, state, ...props }) {
    const [selected, setSelected] = state;

    const handleSelected = (event, selected) => {
        if (selected) {
            setSelected(selected);
        }
    };

    const buttonItems = items.map(button => {
        const { icon, id, name, tooltip = "", ...props } = button;
        return (
            <Tooltip key={id} title={tooltip} arrow>
                <ToggleButton
                    selected={selected === id}
                    value={id}
                    aria-label={name || tooltip || id}
                    {...props}
                >
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
