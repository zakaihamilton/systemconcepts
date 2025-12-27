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

import { Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export function BreadcrumbItem({ index, count, items, label, name, tooltip, Icon, href, hideRoot, navigateLast, description, menuItems }) {
    const { direction } = MainStore.useState();
    const isLast = index === count - 1;
    const deviceType = useDeviceType();
    const SeparatorIcon = direction === "rtl" ? NavigateBeforeIcon : NavigateNextIcon;
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const showLabel =
        deviceType === "phone" && index && (count <= 2 || index === count - 1) ||
        deviceType === "tablet" && index && (count <= 3 || index === count - 1) ||
        deviceType === "desktop" && index && (count <= 6 || index === count - 1);

    const collapse = deviceType === "phone" && count >= 6 ||
        deviceType === "tablet" && count >= 7 ||
        deviceType === "desktop" && count >= 10;

    const title = !showLabel ? (label || name) : tooltip || label || name;

    const gotoItem = (event) => {
        if (isLast && menuItems) {
            event.preventDefault();
            setAnchorEl(event.currentTarget);
            return;
        }
        if (isLast && !navigateLast) {
            event.preventDefault();
            return;
        }
        setHash(href);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleMenuClick = (item) => {
        handleClose();
        if (item.onClick) {
            item.onClick();
        }
    };

    if (collapse && index > 1 && index < count - 2) {
        if (index === count - 3) {
            const path = items.slice(2, -2).map(item => item.label || item.name).join("/");
            return (
                <>
                    <Link className={styles.item} color="inherit" onClick={gotoItem} href={href}>
                        <IconButton className={styles.iconButton} size="small">
                            <Tooltip arrow title={path}>
                                <MoreHorizIcon />
                            </Tooltip>
                        </IconButton>
                    </Link>
                    <div className={styles.separator}>
                        <SeparatorIcon fontSize="small" />
                    </div>
                </>
            );
        }
        return null;
    }

    if (hideRoot && !index) {
        return null;
    }

    const content = (
        <>
            {Icon && (
                <div className={styles.icon}>
                    <Icon />
                </div>
            )}
            {(showLabel || isLast) && (
                <div className={styles.column}>
                    <div className={styles.name}>
                        {label || name}
                    </div>
                    {description && <div className={styles.description}>
                        {description}
                    </div>}
                </div>
            )}
        </>
    );

    return (
        <>
            <Link
                className={clsx(styles.item, isLast && !navigateLast && !menuItems && styles.last)}
                color="inherit"
                href={href}
                onClick={gotoItem}
                underline="none"
            >
                <Tooltip arrow title={title}>
                    <div className={styles.itemContent}>
                        {content}
                    </div>
                </Tooltip>
            </Link>
            {!!menuItems && <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                {menuItems.map((item, index) => (
                    <MenuItem key={index} onClick={() => handleMenuClick(item)}>
                        {item.icon && <div style={{ marginRight: "0.5em", display: "flex" }}>{item.icon}</div>}
                        {item.name}
                    </MenuItem>
                ))}
            </Menu>}
            {!isLast && (
                <div className={styles.separator}>
                    <SeparatorIcon fontSize="small" />
                </div>
            )}
        </>
    );
}

export default function BreadcrumbsWidget({ className, items, border, bar, hideRoot, navigateLast }) {
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const isDesktop = deviceType === "desktop";
    const isTablet = deviceType === "tablet";

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
                    {<Divider orientation="vertical" flexItem style={{ margin: "0 0.5rem" }} />}
                    <div className={styles.breadcrumbs}>
                        {breadcrumbItems}
                    </div>
                    {!!bar && (
                        <>
                            <Toolbar collapsable={true} location={isPhone || isTablet ? ["header", undefined] : undefined} />
                            {isDesktop && <Divider orientation="vertical" flexItem style={{ margin: "0 0.5rem" }} />}
                            {isDesktop && <Toolbar collapsable={true} location="header" />}
                        </>
                    )}
                </NoSsr>
            </div>
        </div>
    );
}

