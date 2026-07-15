import clsx from "clsx";
import { useState } from "react";
import styles from "../shared.module.css";
import Tooltip from "../Tooltip/Tooltip";

export function SpeedDialAction({
	icon,
	onClick,
	className,
	tooltipTitle,
	tooltipOpen,
	"aria-label": ariaLabel,
	...props
}) {
	return (
		<Tooltip title={tooltipTitle} arrow>
			<button
				type="button"
				className={clsx(styles.speedDialAction, className)}
				onClick={onClick}
				aria-label={ariaLabel || tooltipTitle}
				{...props}
			>
				{icon}
				{tooltipOpen && tooltipTitle && (
					<span className={styles.speedDialTooltip}>{tooltipTitle}</span>
				)}
			</button>
		</Tooltip>
	);
}

export function SpeedDialIcon({ icon, openIcon, open }) {
	return open && openIcon ? openIcon : icon;
}

export default function SpeedDial({
	children,
	open: controlledOpen,
	onOpen,
	onClose,
	icon,
	className,
	ariaLabel,
	hidden,
	...props
}) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;

	if (hidden) return null;

	const handleToggle = () => {
		const next = !open;
		setInternalOpen(next);
		if (next) onOpen?.();
		else onClose?.();
	};

	return (
		<div className={clsx(styles.speedDial, className)} {...props}>
			{open && (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					{children}
				</div>
			)}
			<button
				type="button"
				className={styles.fab}
				aria-label={ariaLabel}
				onClick={handleToggle}
			>
				{icon}
			</button>
		</div>
	);
}
