import { useState, Children, cloneElement } from "react";
import { styled } from '@mui/material/styles';
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import styles from "./Menu.module.scss";
import Link from "@mui/material/Link";
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import clsx from "clsx";

const PREFIX = 'Menu';

const classes = {
    paper: `${PREFIX}-paper`
};

const StyledMenuRoot = styled(Menu)(({ theme: _theme }) => ({
    [`& .${classes.paper}`]: {
        borderRadius: 12,
        marginTop: 8,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        border: `1px solid var(--border-color)`,
        backgroundColor: 'var(--bar-background)',
        '& .MuiList-root': {
            padding: '4px 0',
        },
    },
}));

const StyledMenu = ((props) => (
    <StyledMenuRoot
        transitionDuration={150}
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
        }}
        {...props}
    />
));

export default function MenuWidget({ hover, items, children, onClick, selected: menuSelected, onVisible, ...props }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const clickEnabled = items && items.length || onClick;
    const hoverEnabled = clickEnabled && hover;
    const [hoverRef, setHoverRef] = useState(null);
    const [expanded, setExpanded] = useState({});

    const handleToggleExpand = (id) => {
        setExpanded(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleClick = (event) => {
        event && event.stopPropagation && event.stopPropagation();
        if (items && items.length) {
            onVisible && onVisible(true);
            setAnchorEl(event.currentTarget);
        }
        else if (onClick) {
            onClick(event);
        }
    };

    const handleClose = () => {
        onVisible && onVisible(false);
        setAnchorEl(null);
        setHoverRef(null);
        setExpanded({});
    };

    const checkListFeatures = (list) => {
        let hasSelector = false;
        let hasIcon = false;
        (list || []).forEach(item => {
            if (item.icon) hasIcon = true;
            if (typeof item.checked !== "undefined" || typeof item.radio !== "undefined") hasSelector = true;
        });
        return { hasSelector, hasIcon };
    };

    const renderItems = (itemsList) => {
        const { hasSelector, hasIcon } = checkListFeatures(itemsList);
        const hasAnyIcon = hasSelector || hasIcon;
        return (itemsList || []).flatMap((item, index, list) => {
            const isLast = list.length - 1 === index;
            const { checked, radio, header, divider, name, target, icon, items: subItems, onClick: itemOnClick, id, menu: _menu, backgroundColor, description, selected, expanded: itemExpanded, highlight, ...props } = item;
            const selectedItem = typeof selected !== "undefined" ? selected : menuSelected;
            const selectedArray = Array.isArray(selectedItem);
            const isSelected = selectedArray ? selectedItem.includes(id) : selectedItem === id;
            const isSelectedFinal = typeof highlight !== "undefined" ? highlight : (!header && (isSelected || checked));

            const isExpanded = typeof expanded[id] !== "undefined" ? expanded[id] : itemExpanded;
            const hasSubItems = subItems && subItems.length;

            const handleClickItem = event => {
                if (header && hasSubItems) {
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
            const style = { backgroundColor };

            const rightIcon = header && hasSubItems ? (isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />) : null;

            const result = [
                <MenuItem
                    key={id}
                    className={clsx(styles.menuItem, isSelectedFinal && styles.selected, header && styles.headerItem)}
                    component={target ? Link : "div"}
                    underline="none"
                    href={target}
                    onClick={handleClickItem}
                    {...props}
                >
                    <div className={styles.background} style={style} />
                    {!header && hasAnyIcon && (
                        <ListItemIcon className={styles.itemIcon}>
                            {hasSelector && (
                                <div className={styles.selector}>
                                    {!header && (typeof radio !== "undefined" || typeof checked !== "undefined") && (
                                        typeof radio !== "undefined" ? (
                                            radio ? <RadioButtonCheckedIcon color="primary" /> : <RadioButtonUncheckedIcon />
                                        ) : (
                                            checked ? <CheckBoxIcon color="primary" /> : <CheckBoxOutlineBlankIcon />
                                        )
                                    )}
                                </div>
                            )}
                            {hasIcon && (
                                <div className={styles.icon}>
                                    {icon}
                                </div>
                            )}
                        </ListItemIcon>
                    )}
                    <ListItemText
                        className={clsx(styles.itemText, header && styles.headerText)}
                        primary={name}
                        secondary={description}
                        classes={{
                            primary: clsx(styles.primaryText, header && styles.headerPrimary),
                            secondary: styles.secondaryText
                        }}
                    />
                    {rightIcon && (
                        <ListItemIcon className={styles.headerIcon}>
                            {rightIcon}
                        </ListItemIcon>
                    )}
                    {backgroundColor && <div className={styles.backgroundBorder} style={style} />}
                </MenuItem>,
                divider && !isLast && <Divider key={"_" + id + "_"} className={styles.divider} />
            ];

            if (header && hasSubItems && isExpanded) {
                result.push(...renderItems(subItems));
            }

            return result;
        });
    };

    const menuItems = open && renderItems(items);

    children = Children.map(children, child => {
        if (!child) {
            return null;
        }
        const childProps = {};
        if (clickEnabled) {
            childProps.onClick = handleClick;
        }
        if (hoverEnabled) {
            childProps.onMouseEnter = event => {
                setHoverRef(event.currentTarget);
                handleClick(event);
            };
        }
        const element = cloneElement(child, childProps);
        return element;
    });

    return (
        <>
            {children}
            <StyledMenu
                id="menu"
                anchorEl={anchorEl}
                keepMounted
                open={!!open}
                onClose={handleClose}
                {...hoverEnabled && hoverRef && { MenuListProps: { onMouseLeave: handleClose } }}
                PaperProps={{
                    style: {
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important',
                        minWidth: anchorEl ? anchorEl.offsetWidth : undefined,
                    }
                }}
                {...props}
                classes={{
                    paper: classes.paper
                }}>
                {menuItems}
            </StyledMenu>
        </>
    );
}

