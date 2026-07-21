import { Divider } from "@ui";
import IconButton from "@ui/IconButton";
import Link from "@ui/Link";
import { useStyles } from "@util/browser/styles";
import Label from "@widgets/Label";
import Menu from "@widgets/Menu";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { useEffect, useState } from "react";
import styles from "./Item.module.css";

export default function ToolbarItem({
	item,
	idx,
	count,
	tooltipPlacement = "bottom",
}) {
	const [anchorEl, setAnchorEl] = useState(null);
	const classes = useStyles(styles, {
		item: true,
		selected: item.selected === item.id || item.selected === true,
		active: item.active,
	});
	const showDivider = !!item.divider && idx !== count - 1;
	const hasSubmenu = item.items?.length > 0;

	useEffect(() => {
		setAnchorEl(null);
	}, [item.id]);

	const handleTriggerClick = (event) => {
		if (hasSubmenu) {
			event.stopPropagation();
			setAnchorEl(event.currentTarget);
			return;
		}
		item.onClick?.(event);
	};

	const handleCloseMenu = () => {
		setAnchorEl(null);
	};

	return (
		<>
			{item.element && <div className={styles.element}>{item.element}</div>}
			{!item.element && (
				<>
					{!!item.label ? (
						<Label
							className={classes}
							icon={item.icon}
							name={item.name}
							noBorder={true}
							onClick={handleTriggerClick}
						/>
					) : (
						<Tooltip arrow title={item.name} placement={tooltipPlacement}>
							<IconButton
								component={item.target ? Link : "button"}
								underline="none"
								color="inherit"
								href={item.target}
								className={`${classes} ${item.className || ""}`}
								disabled={item.disabled}
								size="small"
								id={item.id}
								onClick={handleTriggerClick}
								aria-label={
									item.ariaLabel ||
									(typeof item.name === "string" ? item.name : undefined)
								}
								aria-haspopup={hasSubmenu || undefined}
								aria-expanded={hasSubmenu ? Boolean(anchorEl) : undefined}
							>
								<div className={styles.iconWrapper}>{item.icon}</div>
							</IconButton>
						</Tooltip>
					)}
					{hasSubmenu && (
						<Menu
							items={item.items}
							selected={item.selected}
							open={Boolean(anchorEl)}
							anchorEl={anchorEl}
							onClose={handleCloseMenu}
						/>
					)}
				</>
			)}
			<Divider
				classes={{ root: clsx(styles.divider, !showDivider && styles.hidden) }}
				orientation="vertical"
				flexItem
			/>
		</>
	);
}
