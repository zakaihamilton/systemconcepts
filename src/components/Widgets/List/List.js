import { MainStore } from "@components/Main";
import ExpandLess from "@icons/ExpandLess";
import ExpandMore from "@icons/ExpandMore";
import Avatar from "@ui/Avatar";
import Collapse from "@ui/Collapse";
import Divider from "@ui/Divider";
import IconButton from "@ui/IconButton";
import Link from "@ui/Link";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import ListItemAvatar from "@ui/ListItemAvatar";
import ListItemButton from "@ui/ListItemButton";
import ListItemIcon from "@ui/ListItemIcon";
import ListItemSecondaryAction from "@ui/ListItemSecondaryAction";
import ListItemText from "@ui/ListItemText";
import { useStyles } from "@util/browser/styles";
import { useState } from "react";
import styles from "./List.module.css";
export function ListItemWidget({
	id,
	divider,
	reverse,
	depth,
	target,
	clickHandler,
	onClick,
	name,
	items,
	selected,
	setSelected,
	description,
	icon,
	avatar,
	action,
	onToggle,
	content,
	isOpen,
}) {
	const { direction } = MainStore.useState();
	const {
		icon: actionIcon,
		label: actionLabel,
		callback: actionCallback,
	} = action || {};
	const isSelected =
		typeof selected === "function"
			? selected(id)
			: Array.isArray(selected)
				? selected.includes(id)
				: selected === id;
	const itemClassName = useStyles(styles, {
		item: true,
		selected: isSelected,
	});
	const iconContainerClassName = useStyles(styles, {
		iconContainer: true,
	});
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = typeof isOpen !== "undefined";
	const open = isControlled ? isOpen : internalOpen;

	let expandIcon = null;
	let rootItemClick = () => {
		if (onClick) {
			onClick(id);
		} else if (setSelected) {
			setSelected(id);
		}
		clickHandler && clickHandler(id);
	};

	const handleToggle = () => {
		const newOpen = !open;
		if (!isControlled) {
			setInternalOpen(newOpen);
		}
		if (onToggle) {
			onToggle(newOpen);
		}
	};

	if ((items && items.length) || content) {
		expandIcon = open ? (
			<ExpandLess className={styles.expandIcon} />
		) : (
			<ExpandMore className={styles.expandIcon} />
		);
		rootItemClick = handleToggle;
	} else {
		expandIcon = <span className={styles.expandPlaceholder} />;
	}
	const elements = (items || []).map((item) => {
		const { id, ...props } = item;
		return (
			<ListItemWidget
				id={id}
				depth={depth + 1}
				key={item.id}
				clickHandler={clickHandler}
				selected={selected}
				setSelected={setSelected}
				{...props}
			/>
		);
	});
	const style = {};
	if (direction === "rtl") {
		style.paddingRight = depth * 1.5 + "em";
	} else {
		style.paddingLeft = depth * 1.5 + "em";
	}
	if (typeof target === "string" && !target.startsWith("#")) {
		target = "#" + target;
	} else if (!target) {
		target = undefined;
	}
	return (
		<>
			<ListItem
				disablePadding
				className={itemClassName}
				divider={!!reverse && !!divider}
			>
				<ListItemButton
					className={styles.itemButton}
					style={style}
					component={target ? Link : undefined}
					underline="none"
					href={target}
					selected={isSelected}
					onClick={rootItemClick}
				>
					{expandIcon}
					{!!avatar && icon && (
						<ListItemAvatar>
							<Avatar className={iconContainerClassName}>{actionIcon}</Avatar>
						</ListItemAvatar>
					)}
					{!avatar && icon && (
						<ListItemIcon className={iconContainerClassName}>
							{icon}
						</ListItemIcon>
					)}
					<ListItemText
						className={styles.itemLabel}
						classes={{
							primary: styles.primary,
							secondary: styles.secondary,
						}}
						primary={name}
						secondary={description}
					/>
				</ListItemButton>
				{!!actionIcon && (
					<ListItemSecondaryAction>
						<IconButton
							edge="end"
							aria-label={actionLabel}
							onClick={actionCallback}
							size="large"
						>
							{actionIcon}
						</IconButton>
					</ListItemSecondaryAction>
				)}
			</ListItem>
			{expandIcon && (
				<Collapse in={open} timeout="auto" unmountOnExit>
					{content ? (
						content
					) : (
						<List component="div" disablePadding>
							{elements}
						</List>
					)}
				</Collapse>
			)}
			{!reverse && !!divider && <Divider />}
		</>
	);
}

export default function ListWidget({ reverse, items, onClick, state }) {
	const [selected, setSelected] = state || [];

	const className = useStyles(styles, {
		root: true,
		reverse,
	});

	const elements = (items || []).map((item) => {
		const { id, ...props } = item;
		return (
			<ListItemWidget
				id={id}
				key={item.id}
				clickHandler={onClick}
				depth={1}
				reverse={reverse}
				selected={selected}
				setSelected={setSelected}
				{...props}
			/>
		);
	});

	return (
		<List className={className} component="nav">
			{elements}
		</List>
	);
}
