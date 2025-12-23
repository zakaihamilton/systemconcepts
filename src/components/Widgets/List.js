import React, { useState } from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import styles from "./List.module.scss";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import { useStyles } from "@util/styles";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { MainStore } from "@components/Main";
import Link from "@mui/material/Link";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";

export function ListItemWidget({ id, divider, reverse, depth, target, clickHandler, onClick, name, items, selected, setSelected, description, icon, avatar, action }) {
    const { direction } = MainStore.useState();
    const { icon: actionIcon, label: actionLabel, callback: actionCallback } = action || {};
    const isSelected = typeof selected === "function" ? selected(id) : (Array.isArray(selected) ? selected.includes(id) : selected === id);
    const itemClassName = useStyles(styles, {
        item: true,
        selected: isSelected
    });
    const iconContainerClassName = useStyles(styles, {
        iconContainer: true
    });
    const [open, setOpen] = useState(false);
    let expandIcon = null;
    let rootItemClick = () => {
        if (onClick) {
            onClick(id);
        }
        else if (setSelected) {
            setSelected(id);
        }
        clickHandler && clickHandler(id);
    };
    if (items && items.length) {
        expandIcon = open ? <ExpandLess className={styles.expandIcon} /> : <ExpandMore className={styles.expandIcon} />;
        rootItemClick = () => {
            setOpen(!open);
        };
    }
    const elements = (items || []).map(item => {
        const { id, ...props } = item;
        return <ListItemWidget
            id={id}
            depth={depth + 1}
            key={item.id}
            clickHandler={clickHandler}
            selected={selected}
            setSelected={setSelected}
            {...props} />;
    });
    const style = {};
    if (direction === "rtl") {
        style.paddingRight = (depth * 1.5) + "em";
    }
    else {
        style.paddingLeft = (depth * 1.5) + "em";
    }
    if (target && !target.startsWith("#")) {
        target = "#" + target;
    }
    else if (!target) {
        target = undefined;
    }
    return <>
        <ListItem disablePadding className={itemClassName} divider={!!reverse && !!divider}>
            <ListItemButton style={style} component={target ? Link : undefined} underline="none" href={target} selected={isSelected} onClick={rootItemClick}>
                {!!avatar && icon && <ListItemAvatar>
                    <Avatar className={iconContainerClassName}>
                        {actionIcon}
                    </Avatar>
                </ListItemAvatar>}
                {!avatar && icon && <ListItemIcon className={iconContainerClassName}>
                    {icon}
                </ListItemIcon>}
                <ListItemText className={styles.itemLabel} primary={name} secondary={description} />
                {expandIcon}
            </ListItemButton>
            {!!actionIcon && <ListItemSecondaryAction>
                <IconButton edge="end" aria-label={actionLabel} onClick={actionCallback} size="large">
                    {actionIcon}
                </IconButton>
            </ListItemSecondaryAction>}
        </ListItem>
        {expandIcon && <Collapse in={open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
                {elements}
            </List>
        </Collapse>}
        {!reverse && !!divider && <Divider />}
    </>;
}

export default function ListWidget({ reverse, items, onClick, state }) {
    const [selected, setSelected] = state || [];

    const className = useStyles(styles, {
        root: true,
        reverse
    });

    const elements = (items || []).map(item => {
        const { id, ...props } = item;
        return <ListItemWidget id={id} key={item.id} clickHandler={onClick} depth={1} reverse={reverse} selected={selected} setSelected={setSelected} {...props} />;
    });

    return <List className={className} component="nav">
        {elements}
    </List>;
}
