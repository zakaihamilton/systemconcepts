import React, { useState } from 'react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import styles from "./List.module.scss";
import Avatar from '@material-ui/core/Avatar';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import { useStyles } from "@util/styles";
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import { MainStore } from "@components/Main";

export function ListItemWidget({ id, divider, reverse, viewType, depth, clickHandler, onClick, name, items, selected, setSelected, description, icon, avatar, action }) {
    const { direction } = MainStore.useState();
    const { icon: actionIcon, label: actionLabel, callback: actionCallback } = action || {};
    const isSelected = typeof selected === "function" ? selected(id) : selected === id;
    const itemClassName = useStyles(styles, {
        itemList: viewType === "List",
        itemIconList: viewType === "IconList",
        selected: isSelected
    });
    const iconContainerClassName = useStyles(styles, {
        iconContainerList: viewType === "List",
        iconContainerIconList: viewType === "IconList"
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
    }
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
            viewType={viewType}
            selected={selected}
            setSelected={setSelected}
            {...props} />
    });
    const style = {};
    if (direction === "rtl") {
        style.paddingRight = (depth * 1.5) + "em";
    }
    else {
        style.paddingLeft = (depth * 1.5) + "em";
    }
    return <>
        {viewType === "List" && !!reverse && !!divider && <Divider />}
        <ListItem style={style} className={itemClassName} button selected={isSelected} onClick={rootItemClick}>
            {!!avatar && icon && <ListItemAvatar>
                <Avatar className={iconContainerClassName}>
                    {actionIcon}
                </Avatar>
            </ListItemAvatar>}
            {!avatar && icon && <ListItemIcon className={iconContainerClassName}>
                {icon}
            </ListItemIcon>}
            <ListItemText className={styles.itemLabel} primary={name} secondary={description} />
            {actionIcon && <ListItemSecondaryAction>
                <IconButton edge="end" aria-label={actionLabel} onClick={actionCallback}>
                    {actionIcon}
                </IconButton>
            </ListItemSecondaryAction>}
            {expandIcon}
        </ListItem>
        {expandIcon && <Collapse in={open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
                {elements}
            </List>
        </Collapse>}
        {viewType === "List" && !reverse && !!divider && <Divider />}
    </>;
}

export default function ListWidget({ reverse, items, onClick, state, viewType }) {
    const [selected, setSelected] = state || [];

    const className = useStyles(styles, {
        root: true,
        iconList: viewType === "IconList",
        list: viewType === "List",
        reverse
    });

    const elements = (items || []).map(item => {
        const { id, ...props } = item;
        return <ListItemWidget id={id} key={item.id} clickHandler={onClick} depth={1} viewType={viewType} reverse={reverse} selected={selected} setSelected={setSelected} {...props} />
    });

    return <List className={className} component="nav">
        {elements}
    </List>
}
