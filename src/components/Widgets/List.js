import React from 'react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import styles from "./List.module.scss";
import Avatar from '@material-ui/core/Avatar';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import { useStyles } from "@/util/styles";

export function ListItemWidget({ separator, viewType, onClick, name, selected, description, icon, avatar, action }) {
    const { icon: actionIcon, label: actionLabel, callback: actionCallback } = action || {};
    const itemClassName = useStyles(styles, {
        itemList: viewType === "List",
        itemIconList: viewType === "IconList"
    });
    const iconContainerClassName = useStyles(styles, {
        iconContainerList: viewType === "List",
        iconContainerIconList: viewType === "IconList"
    });
    const iconClassName = useStyles(styles, {
        iconList: viewType === "List",
        iconIconList: viewType === "IconList"
    });
    return <>
        <ListItem className={itemClassName} button selected={selected} onClick={onClick}>
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
        </ListItem>
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
        return <ListItemWidget key={item.id} onClick={() => onItemClick(id)} viewType={viewType} selected={selected === item.id} {...props} />
    });

    return <List className={className} component="nav">
        {elements}
    </List>
}
