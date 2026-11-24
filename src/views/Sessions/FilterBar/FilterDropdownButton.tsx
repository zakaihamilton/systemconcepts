import ArrowDropDownIcon from "@icons/svg/ArrowDropDown.svg";
import CloseIcon from "@icons/svg/Close.svg";
import Menu from "@widgets/Menu";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import styles from "./FilterBar.module.css";
import type { FilterButtonLabel } from "./filterDefinitions";

interface FilterDropdownButtonProps {
	items: any[];
	selected: string[];
	label: FilterButtonLabel;
	clearTitle: string;
	onClear: (e: any) => void;
}

/**
 * Renders a filter dropdown trigger wrapped in Menu with active state and clear button.
 */
export default function FilterDropdownButton({
	items,
	selected,
	label,
	clearTitle,
	onClear,
}: FilterDropdownButtonProps) {
	const isActive = selected.length > 0;

	return (
		<Menu items={items} selected={selected}>
			<button
				className={clsx(styles.dropdownButton, isActive && styles.active)}
			>
				<ArrowDropDownIcon className={styles.arrow} />
				<div className={styles.labelContent}>
					{typeof label === "string" ? (
						<span>{label}</span>
					) : (
						<>
							<span className={styles.mainLabel}>{label.main}</span>
							<span className={styles.subLabel}>{label.sub}</span>
						</>
					)}
				</div>
				{isActive && (
					<Tooltip title={clearTitle}>
						<span>
							<CloseIcon className={styles.clearIcon} onClick={onClear} />
						</span>
					</Tooltip>
				)}
			</button>
		</Menu>
	);
}
