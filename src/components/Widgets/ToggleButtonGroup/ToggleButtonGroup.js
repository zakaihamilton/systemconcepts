import ToggleButton from "@ui/ToggleButton";
import ToggleButtonGroup from "@ui/ToggleButtonGroup";
import Tooltip from "@widgets/Tooltip";
import { cloneElement } from "react";
import styles from "./ToggleButtonGroup.module.css";

export default function ToggleButtonGroupWidget({ items, state, ...props }) {
	const [selected, setSelected] = state;

	const handleSelected = (_event, selected) => {
		if (selected) {
			setSelected(selected);
		}
	};

	const buttonItems = items.map((button) => {
		const { icon, id, name, tooltip = "", ...props } = button;
		const toggleButton = (
			<ToggleButton
				selected={selected === id}
				value={id}
				aria-label={name || tooltip || id}
				{...props}
			>
				{icon || name}
			</ToggleButton>
		);

		if (!tooltip) {
			return cloneElement(toggleButton, { key: id });
		}

		return (
			<Tooltip key={id} title={tooltip} arrow>
				{toggleButton}
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
