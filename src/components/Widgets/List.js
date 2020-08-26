import React, { useState } from 'react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import styles from "./List.module.scss";
import Avatar from '@material-ui/core/Avatar';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import { useStyles } from "@/util/styles";
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import { MainStore } from "@/components/Main";

export function ListItemWidget({ id, separator, viewType, depth, onClick, name, items, selected, description, icon, avatar, action }) {
    const { direction } = MainStore.useState();
    const { icon: actionIcon, label: actionLabel, callback: actionCallback } = action || {};
    const itemClassName = useStyles(styles, {
        itemList: viewType === "List",
        itemIconList: viewType === "IconList"
    });
    const iconContainerClassName = useStyles(styles, {
        iconContainerList: viewType === "List",
        iconContainerIconList: viewType === "IconList"
    });
    const [open, setOpen] = useState(false);
    let expandIcon = null;
    let rootItemClick = onClick;
    if (items && items.length) {
        expandIcon = open ? <ExpandLess /> : <ExpandMore />;
        rootItemClick = () => {
            setOpen(!open);
        };
    }
    const elements = (items || []).map(item => {
        const { id, ...props } = item;
        return <ListItemWidget id={id} depth={depth + 1} key={item.id} onClick={() => onClick(id)} viewType={viewType} selected={selected} {...props} />
    });
    const style = {};
    if (direction === "rtl") {
        style.paddingRight = (depth * 1.5) + "em";
    }
    else {
        style.paddingLeft = (depth * 1.5) + "em";
    }
    return <>
        <ListItem style={style} className={itemClassName} button selected={selected === id} onClick={rootItemClick}>
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
                {open && elements}
            </List>
        </Collapse>}
        {viewType === "List" && separator && <Divider />}
    </>;
}

export default function ListWidget({ reverse, items, onClick, state, viewType }) {
    const [selected, setSelected] = state || [];

    const onItemClick = (id) => {
        setSelected && setSelected(id);
        onClick && onClick(id);
    };

    const className = useStyles(styles, {
        root: true,
        iconList: viewType === "IconList",
        list: viewType === "List",
        reverse
    });

    const elements = (items || []).map(item => {
        const { id, ...props } = item;
        return <ListItemWidget id={id} key={item.id} onClick={() => onItemClick(id)} depth={1} viewType={viewType} selected={selected} {...props} />
    });

    return <List className={className} component="nav">
        {elements}
    </List>
}
