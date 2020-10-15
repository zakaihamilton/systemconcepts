import React from 'react';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import { Divider } from "@material-ui/core";
import IconButton from '@material-ui/core/IconButton';
import { MainStore } from "@/components/Main";
import styles from "./Breadcrumbs.module.scss";
import { useDeviceType } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import Toolbar from "@/components/Toolbar";
import MenuIcon from "./AppBar/MenuIcon";

export function BreadcrumbItem({ index, count, items, name, tooltip, icon, href }) {
    const { direction } = MainStore.useState();
    const isLast = index === count - 1;
    const deviceType = useDeviceType();
    const SeparatorIcon = direction === "rtl" ? NavigateBeforeIcon : NavigateNextIcon;
    const showName =
        deviceType === "phone" && index && (count <= 2 || index === count - 1) ||
        deviceType === "tablet" && index && (count <= 3 || index === count - 1) ||
        deviceType === "desktop" && index && (count <= 6 || index === count - 1);
    const collapse = deviceType === "phone" && count >= 6 ||
        deviceType === "tablet" && count >= 7 ||
        deviceType === "desktop" && count >= 10;
    const title = !showName ? name : tooltip || name;
    if (collapse && index > 1 && index < count - 2) {
        if (index === count - 3) {
            const path = items.slice(2, -2).map(item => item.name).join("/");
            return <Link className={styles.item} color="inherit" href={href}>
                <IconButton className={styles.iconButton}>
                    <Tooltip arrow title={path}>
                        <MoreHorizIcon />
                    </Tooltip>
                </IconButton>
                <SeparatorIcon className={styles.separator} fontSize="small" />
            </Link>;
        }
        return null;
    }
    return <>
        {isLast && <div className={styles.item}>
            <Tooltip arrow title={title}>
                <div className={styles.icon}>
                    {icon}
                </div>
            </Tooltip>
            <Tooltip arrow title={name}>
                <div className={styles.name}>
                    {name}
                </div>
            </Tooltip>
        </div>}
        {!isLast && <Link className={styles.item} color="inherit" href={href}>
            {icon && <IconButton className={styles.iconButton}>
                <Tooltip arrow title={title}>
                    {icon}
                </Tooltip>
            </IconButton>}
            {!!showName && <Tooltip arrow title={name}>
                <div className={styles.name}>
                    {name}
                </div>
            </Tooltip>}
        </Link>}
        {!isLast && <SeparatorIcon className={styles.separator} fontSize="small" />}
    </>;
}

export default function BreadcrumbsWidget({ items }) {
    const { fullscreen } = MainStore.useState();
    const breadcrumbItems = (items || []).map((item, index, list) => {
        const { id, url, ...props } = item;
        const href = "#" + url;
        return <BreadcrumbItem key={href} items={items} index={index} count={list.length} href={href} {...props} />
    });

    return (
        <div className={styles.root}>
            <div className={styles.row}>
                {fullscreen && <MenuIcon />}
                {fullscreen && <Divider classes={{ root: styles.divider }} orientation="vertical" />}
                <div className={styles.breadcrumbs}>
                    {breadcrumbItems}
                </div>
                <Toolbar collapsable={true} />
            </div>
        </div>
    );
}
