import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import styles from "./Menu.module.scss";

const StyledMenu = withStyles({
    paper: {
        border: '1px solid #d3d4d5',
    },
})((props) => (
    <Menu
        transitionDuration={0}
        elevation={0}
        getContentAnchorEl={null}
        {...props}
    />
));

export default function MenuWidget({ items, children, onClick, selected: menuSelected, onVisible, ...props }) {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const clickEnabled = items && items.length || onClick;

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
    };

    const menuItems = open && (items || []).flatMap((item, index, list) => {
        const isLast = list.length - 1 === index;
        const { divider, name, icon, items, onClick, id, menu, backgroundColor, description, selected, ...props } = item;
        const selectedItem = typeof selected !== "undefined" ? selected : menuSelected;
        const selectedArray = Array.isArray(selectedItem);
        const isSelected = selectedArray ? selectedItem.includes(id) : selectedItem === id;
        const handleClick = event => {
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
            <MenuItem key={id} className={styles.item} selected={isSelected} onClick={items ? undefined : handleClick} {...props}>
                <div key={id + "_background"} className={styles.background} style={style} />
                <MenuWidget items={item.items} selected={isSelected} onClick={items ? handleClick : undefined}>
                    <ListItemIcon>
                        {icon}
                    </ListItemIcon>
                    <ListItemText primary={name} secondary={description} />
                </MenuWidget>
                <div key={id + "_border"} className={styles.backgroundBorder} style={style} />
            </MenuItem>,
            divider && !isLast && <Divider key={"_" + id + "_"} />
        ];
    });

    children = React.Children.map(children, child => {
        if (!child) {
            return null;
        }
        const props = {};
        if (clickEnabled) {
            props.onClick = handleClick;
        }
        const element = React.cloneElement(child, props);
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
                {...props}
            >
                {menuItems}
            </StyledMenu>
        </>
    );
}
