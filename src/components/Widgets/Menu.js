import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

const StyledMenu = withStyles({
    paper: {
        border: '1px solid #d3d4d5',
    },
})((props) => (
    <Menu
        elevation={0}
        getContentAnchorEl={null}
        {...props}
    />
));

export default function MenuWidget({ items, children, onClick, selected, onVisible, ...props }) {
    const [anchorEl, setAnchorEl] = React.useState(null);

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

    const menuItems = (items || []).map(item => {
        const { name, icon, onClick, id, ...props } = item;
        const handleClick = event => {
            handleClose();
            if (onClick) {
                event = { ...event };
                event.target = { ...event.target };
                event.target.value = id;
                onClick(event);
            }
        };
        return <MenuItem key={id} selected={selected === id} onClick={handleClick} {...props}>
            <ListItemIcon>
                {icon}
            </ListItemIcon>
            <ListItemText primary={name} />
        </MenuItem>;
    });

    children = React.Children.map(children, child => {
        if (!child) {
            return null;
        }
        const props = {};
        if (clickEnabled) {
            props.onClick = handleClick;
        }
        return React.cloneElement(child, props);
    });

    return (
        <>
            {children}
            <StyledMenu
                id="menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
                {...props}
            >
                {menuItems}
            </StyledMenu>
        </>
    );
}
