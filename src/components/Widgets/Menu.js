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

const PREFIX = 'Menu';

const classes = {
    paper: `${PREFIX}-paper`
};

const StyledMenuRoot = styled(Menu)({
    [`& .${classes.paper}`]: {
        border: "1px solid #d3d4d5",
    },
});

const StyledMenu = ((props) => (
    <StyledMenuRoot
        transitionDuration={0}
        elevation={0}
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

    const menuItems = open && (items || []).flatMap((item, index, list) => {
        const isLast = list.length - 1 === index;
        const { checked, divider, name, target, icon, items, onClick, id, menu, backgroundColor, description, selected, ...props } = item;
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
                    {typeof checked !== "undefined" &&
                        <ListItemIcon className={styles.itemIcon}>
                            {checked ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                        </ListItemIcon>
                    }
                    <ListItemIcon className={styles.itemIcon}>
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
            };
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
                classes={{
                    paper: classes.paper
                }}>
                {menuItems}
            </StyledMenu>
        </>
    );
}
