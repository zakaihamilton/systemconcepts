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
import clsx from "clsx";

const PREFIX = 'Menu';

const classes = {
    paper: `${PREFIX}-paper`
};

const StyledMenuRoot = styled(Menu)(({ theme }) => ({
    [`& .${classes.paper}`]: {
        borderRadius: 12,
        marginTop: 8,
        minWidth: 200,
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

    const handleClick = (event) => {
        if (items && items.length) {
            onVisible && onVisible(true);
            setAnchorEl(event.currentTarget);
        }
        else if (onClick) {
            onClick();
        }
    };

    const handleClose = () => {
        onVisible && onVisible(false);
        setAnchorEl(null);
        setHoverRef(null);
    };

    const hasIcon = (items || []).some(item => item.icon || typeof item.checked !== "undefined");
    const menuItems = open && (items || []).flatMap((item, index, list) => {
        const isLast = list.length - 1 === index;
        const { checked, divider, name, target, icon, items, onClick, id, menu, backgroundColor, description, selected, ...props } = item;
        const selectedItem = typeof selected !== "undefined" ? selected : menuSelected;
        const selectedArray = Array.isArray(selectedItem);
        const isSelected = selectedArray ? selectedItem.includes(id) : selectedItem === id;
        const isSelectedFinal = isSelected || checked;

        const handleClickItem = event => {
            if (!selectedArray) {
                handleClose();
            }
            if (onClick) {
                event = { ...event };
                event.target = { ...event.target };
                event.target.value = id;
                onClick(event);
            }
        };
        const style = { backgroundColor };
        return [
            <MenuWidget key={id} items={items} selected={isSelected} onClick={handleClickItem}>
                <MenuItem
                    className={clsx(styles.menuItem, isSelectedFinal && styles.selected)}
                    component={target ? Link : "div"}
                    underline="none"
                    href={target}
                    {...props}
                >
                    <div key={id + "_background"} className={styles.background} style={style} />
                    {hasIcon && (
                        <ListItemIcon className={styles.itemIcon}>
                            {typeof checked !== "undefined" ? (
                                checked ? <CheckBoxIcon color="primary" /> : <CheckBoxOutlineBlankIcon />
                            ) : (
                                icon
                            )}
                        </ListItemIcon>
                    )}
                    <ListItemText
                        className={styles.itemText}
                        primary={name}
                        secondary={description}
                        classes={{
                            primary: styles.primaryText,
                            secondary: styles.secondaryText
                        }}
                    />
                    {backgroundColor && <div key={id + "_border"} className={styles.backgroundBorder} style={style} />}
                </MenuItem>
            </MenuWidget>,
            divider && !isLast && <Divider key={"_" + id + "_"} className={styles.divider} />
        ];
    });

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
                {...props}
                classes={{
                    paper: classes.paper
                }}>
                {menuItems}
            </StyledMenu>
        </>
    );
}

