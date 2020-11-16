import { useState, forwardRef, Children, cloneElement } from 'react';
import { withStyles } from '@material-ui/core/styles';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import styles from "./Menu.module.scss";
import Link from '@material-ui/core/Link';

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

const MenuWidget = forwardRef(function MenuComponent({ hover, items, children, onClick, selected: menuSelected, onVisible, ...props }, ref) {
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

    const menuItems = open && (items || []).flatMap((item, index, list) => {
        const isLast = list.length - 1 === index;
        const { divider, name, target, icon, items, onClick, id, menu, backgroundColor, description, selected, ...props } = item;
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
            <MenuWidget key={id} items={items} selected={isSelected} onClick={handleClick}>
                <MenuItem color="initial" component={Link} underline="none" href={target} selected={isSelected} {...props}>
                    <div key={id + "_background"} className={styles.background} style={style} />
                    <ListItemIcon>
                        {icon}
                    </ListItemIcon>
                    <ListItemText className={styles.itemText} primary={name} secondary={description} />
                    <div key={id + "_border"} className={styles.backgroundBorder} style={style} />
                </MenuItem>
            </MenuWidget>,
            divider && !isLast && <Divider key={"_" + id + "_"} />
        ];
    });

    children = Children.map(children, child => {
        if (!child) {
            return null;
        }
        const props = {};
        if (clickEnabled) {
            props.onClick = handleClick;
        }
        if (hoverEnabled) {
            props.onHoverComplete = event => {
                setHoverRef(event.currentTarget);
                handleClick(event);
            }
        }
        const element = cloneElement(child, props);
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
            >
                {menuItems}
            </StyledMenu>
        </>
    );
});

export default MenuWidget;