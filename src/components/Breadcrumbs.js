import React from "react";
import Link from "@mui/material/Link";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import { Divider } from "@mui/material";
import { MainStore } from "@components/Main";
import styles from "./Breadcrumbs.module.scss";
import { useDeviceType } from "@util/styles";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import Toolbar from "@components/Toolbar";
import MenuIcon from "./AppBar/MenuIcon";
import clsx from "clsx";
import NoSsr from "@mui/material/NoSsr";
import { setHash } from "@util/pages";

export function BreadcrumbItem({ index, count, items, label, name, tooltip, icon, href, hideRoot, navigateLast }) {
    const { direction } = MainStore.useState();
    const isLast = index === count - 1;
    const deviceType = useDeviceType();
    const SeparatorIcon = direction === "rtl" ? NavigateBeforeIcon : NavigateNextIcon;
    const showLabel =
        deviceType === "phone" && index && (count <= 2 || index === count - 1) ||
        deviceType === "tablet" && index && (count <= 3 || index === count - 1) ||
        deviceType === "desktop" && index && (count <= 6 || index === count - 1);
    const collapse = deviceType === "phone" && count >= 6 ||
        deviceType === "tablet" && count >= 7 ||
        deviceType === "desktop" && count >= 10;
    const title = !showLabel ? (label || name) : tooltip || label || name;
    const gotoItem = () => {
        setHash(href);
    };
    if (collapse && index > 1 && index < count - 2) {
        if (index === count - 3) {
            const path = items.slice(2, -2).map(item => item.label || item.name).join("/");
            return (
                <Link className={styles.item} color="inherit" onClick={gotoItem} href={href}>
                    <IconButton className={styles.iconButton} size="large">
                        <Tooltip arrow title={path}>
                            <MoreHorizIcon />
                        </Tooltip>
                    </IconButton>
                    <SeparatorIcon fontSize="small" />
                </Link>
            );
        }
        return null;
    }
    if (hideRoot && !index) {
        return null;
    }
    return <>
        {isLast && !navigateLast && <div className={styles.item}>
            <Tooltip arrow title={title}>
                <div className={styles.icon}>
                    {icon}
                </div>
            </Tooltip>
            <Tooltip arrow title={label || name}>
                <div className={styles.name}>
                    {label || name}
                </div>
            </Tooltip>
        </div>}
        {(!isLast || navigateLast) && <Link className={styles.item} color="inherit" href={href} onClick={gotoItem}>
            {icon && <IconButton className={styles.iconButton} size="large">
                <Tooltip arrow title={title}>
                    {icon}
                </Tooltip>
            </IconButton>}
            {!!showLabel && <Tooltip arrow title={label || name}>
                <div className={styles.name}>
                    {label || name}
                </div>
            </Tooltip>}
        </Link>}
        {!isLast && <SeparatorIcon fontSize="small" />}
    </>;
}

export default function BreadcrumbsWidget({ className, items, border, bar, hideRoot, navigateLast }) {
    const isPhone = useDeviceType() === "phone";
    let breadcrumbItems = (items || []).filter(({ breadcrumbs }) => typeof breadcrumbs === "undefined" || breadcrumbs);
    breadcrumbItems = breadcrumbItems.map((item, index, list) => {
        const { id, url, ...props } = item;
        const href = "#" + url;
        return <BreadcrumbItem
            key={href}
            items={items}
            index={index}
            count={list.length}
            href={href}
            navigateLast={navigateLast}
            hideRoot={hideRoot}
            {...props} />;
    }).filter(Boolean);

    return (
        <div className={clsx(styles.root, bar && styles.bar, border && styles.border, className)}>
            <div className={styles.row}>
                <NoSsr>
                    {!!bar && <MenuIcon />}
                    {<Divider classes={{ root: styles.divider }} orientation="vertical" />}
                    <div className={styles.breadcrumbs}>
                        {breadcrumbItems}
                    </div>
                    {!!bar && <Toolbar collapsable={true} location={isPhone ? ["header", undefined] : undefined} />}
                </NoSsr>
            </div>
        </div>
    );
}
