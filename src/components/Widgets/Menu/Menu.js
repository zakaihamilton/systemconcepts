import CheckBoxIcon from "@icons/svg/CheckBox.svg";
import CheckBoxOutlineBlankIcon from "@icons/svg/CheckBoxOutlineBlank.svg";
import ChevronRightIcon from "@icons/svg/ChevronRight.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import RadioButtonCheckedIcon from "@icons/svg/RadioButtonChecked.svg";
import RadioButtonUncheckedIcon from "@icons/svg/RadioButtonUnchecked.svg";
import Divider from "@ui/Divider";
import Link from "@ui/Link";
import ListItemIcon from "@ui/ListItemIcon";
import ListItemText from "@ui/ListItemText";
import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import styles from "./Menu.module.css";

export default function MenuWidget({
	hover,
	items,
	children,
	onClick,
	selected: menuSelected,
	onVisible,
	open: openProp,
	anchorEl: anchorElProp,
	onClose: onCloseProp,
	...props
}) {
	const [anchorElInternal, setAnchorElInternal] = useState(null);
	const isControlled = openProp !== undefined;
	const anchorEl = isControlled ? anchorElProp : anchorElInternal;
	const open = isControlled ? Boolean(openProp) : Boolean(anchorElInternal);
	const clickEnabled = !isControlled && ((items && items.length) || onClick);
	const hoverEnabled = clickEnabled && hover;
	const [_hoverRef, setHoverRef] = useState(null);
	const [expanded, setExpanded] = useState({});
	const prevExpandedRef = useRef({});

	useEffect(() => {
		const prevExpanded = prevExpandedRef.current;
		const newlyExpandedId = Object.keys(expanded).find(
			(id) => expanded[id] && !prevExpanded[id],
		);

		if (newlyExpandedId) {
			const element = document.querySelector(
				`[data-menu-id="${newlyExpandedId}"]`,
			);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}
		prevExpandedRef.current = expanded;
	}, [expanded]);

	const handleToggleExpand = (id) => {
		setExpanded((prev) => {
			const isExpanded = !prev[id];
			return {
				[id]: isExpanded,
			};
		});
	};

	const handleClose = () => {
		onVisible && onVisible(false);
		if (isControlled) {
			onCloseProp?.();
		} else {
			setAnchorElInternal(null);
		}
		setHoverRef(null);
		setExpanded({});
	};

	const openMenu = (event) => {
		if (items && items.length) {
			onVisible && onVisible(true);
			setAnchorElInternal(event.currentTarget);
		} else if (onClick) {
			onClick(event);
		}
	};

	const checkListFeatures = (list) => {
		let hasSelector = false;
		let hasIcon = false;
		(list || []).forEach((item) => {
			if (item.icon) hasIcon = true;
			if (
				typeof item.checked !== "undefined" ||
				typeof item.radio !== "undefined"
			)
				hasSelector = true;
		});
		return { hasSelector, hasIcon };
	};

	const renderItems = (itemsList) => {
		const { hasSelector, hasIcon } = checkListFeatures(itemsList);
		const hasAnyIcon = hasSelector || hasIcon;
		return (itemsList || []).flatMap((item, index, list) => {
			const isLast = list.length - 1 === index;
			const {
				checked,
				radio,
				header,
				divider,
				name,
				target,
				icon,
				items: subItems,
				onClick: itemOnClick,
				id,
				menu: _menu,
				backgroundColor,
				background,
				description,
				selected,
				expanded: itemExpanded,
				highlight,
				...itemProps
			} = item;
			const selectedItem =
				typeof selected !== "undefined" ? selected : menuSelected;
			const selectedArray = Array.isArray(selectedItem);
			const isSelected = selectedArray
				? selectedItem.includes(id)
				: selectedItem === id;
			const isSelectedFinal =
				typeof highlight !== "undefined"
					? highlight
					: !header && (isSelected || checked);

			const isExpanded =
				typeof expanded[id] !== "undefined" ? expanded[id] : itemExpanded;
			const hasSubItems = subItems && subItems.length;

			const handleClickItem = (event) => {
				if (header && hasSubItems) {
					handleToggleExpand(id);
					return;
				}
				if (hasSubItems && !itemOnClick) {
					handleToggleExpand(id);
					return;
				}
				if (!selectedArray && !header) {
					handleClose();
				}
				if (itemOnClick) {
					if (event) {
						event = { ...event };
						event.target = { ...event.target };
						event.target.value = id;
					}
					itemOnClick(event);
				}
			};
			const style = { backgroundColor, background };

			const rightIcon =
				header && hasSubItems ? (
					isExpanded ? (
						<ExpandMoreIcon />
					) : (
						<ChevronRightIcon />
					)
				) : null;

			const result = [
				<MenuItem
					key={id}
					data-menu-id={id}
					className={clsx(
						styles.menuItem,
						isSelectedFinal && styles.selected,
						header && styles.headerItem,
					)}
					component={target ? Link : "div"}
					underline="none"
					href={target}
					onClick={handleClickItem}
					{...itemProps}
				>
					<div className={styles.background} style={style} />
					{!header && hasAnyIcon && (
						<ListItemIcon className={styles.itemIcon}>
							{hasSelector && (
								<div className={styles.selector}>
									{!header &&
										(typeof radio !== "undefined" ||
											typeof checked !== "undefined") &&
										(typeof radio !== "undefined" ? (
											radio ? (
												<RadioButtonCheckedIcon color="primary" />
											) : (
												<RadioButtonUncheckedIcon />
											)
										) : checked ? (
											<CheckBoxIcon color="primary" />
										) : (
											<CheckBoxOutlineBlankIcon />
										))}
								</div>
							)}
							{hasIcon && <div className={styles.icon}>{icon}</div>}
						</ListItemIcon>
					)}
					<ListItemText
						className={clsx(styles.itemText, header && styles.headerText)}
						primary={name}
						secondary={description}
						classes={{
							primary: clsx(styles.primaryText, header && styles.headerPrimary),
							secondary: styles.secondaryText,
						}}
					/>
					{rightIcon && (
						<ListItemIcon className={styles.headerIcon}>
							{rightIcon}
						</ListItemIcon>
					)}
					{(backgroundColor || background) && (
						<div className={styles.backgroundBorder} style={style} />
					)}
				</MenuItem>,
				divider && !isLast && (
					<Divider key={"_" + id + "_"} className={styles.divider} />
				),
			];

			if ((header || hasSubItems) && isExpanded) {
				result.push(...renderItems(subItems));
			}

			return result;
		});
	};

	const menuItems = open && renderItems(items);

	const trigger = children && (
		<span
			className={styles.trigger}
			onClick={
				clickEnabled
					? (event) => {
							event.stopPropagation();
							openMenu(event);
						}
					: undefined
			}
			onMouseEnter={
				hoverEnabled
					? (event) => {
							setHoverRef(event.currentTarget);
							openMenu(event);
						}
					: undefined
			}
		>
			{children}
		</span>
	);

	return (
		<>
			{!isControlled && trigger}
			<Menu
				anchorEl={anchorEl}
				open={!!open}
				onClose={handleClose}
				className={styles.menuPaper}
				style={{
					minWidth: anchorEl ? anchorEl.offsetWidth : undefined,
				}}
				{...props}
			>
				{menuItems}
			</Menu>
		</>
	);
}
