
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
import SidebarIcon from "./AppBar/SidebarIcon";
import clsx from "clsx";
import NoSsr from "@mui/material/NoSsr";
import { setHash } from "@util/pages";

import { Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export function BreadcrumbItem({ index, count, items, label, name, tooltip, Icon, icon, href, hideRoot, navigateLast, description, menuItems, onClick, static: isStaticProp }) {
    const { direction } = MainStore.useState();
    const isLast = index === count - 1;
    const isStatic = isStaticProp || (isLast && !navigateLast && !menuItems && !onClick);
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

    const title = (!showLabel ? (label || name) : tooltip || label || name) || "";

    const gotoItem = (event) => {
        if (isStaticProp) {
            event.preventDefault();
            return;
        }
        if (onClick) {
            event.preventDefault();
            onClick();
            return;
        }
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
                    <Tooltip arrow title={path || ""}>
                        <span>
                            <Link className={styles.item} color="inherit" onClick={gotoItem} href={href}>
                                <IconButton className={styles.iconButton} size="small">
                                    <MoreHorizIcon />
                                </IconButton>
                            </Link>
                        </span>
                    </Tooltip>
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
            {(Icon || icon) && (
                <div className={styles.icon}>
                    {icon || <Icon />}
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
            <Tooltip arrow title={title}>
                <span className={clsx(styles.itemWrapper, (showLabel || isLast) && styles.hasLabel)}>
                    <Link
                        className={clsx(styles.item, isStatic && styles.static, menuItems && styles.menuItems)}
                        color="inherit"
                        href={href}
                        onClick={gotoItem}
                        underline="none"
                    >
                        <span className={styles.itemContent}>
                            {content}
                        </span>
                    </Link>
                </span>
            </Tooltip>
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

    const firstLibraryIndex = (items || []).findIndex(i => i.id === "library" && i.custom);
    let breadcrumbItems = (items || []).filter((item, index) => {
        const { breadcrumbs } = item;
        if (typeof breadcrumbs !== "undefined" && !breadcrumbs) return false;

        if (firstLibraryIndex !== -1 && index >= firstLibraryIndex) {
            const isRoot = index === firstLibraryIndex;
            const hasChildren = items.length > firstLibraryIndex + 1;

            if (isPhone) {
                // On mobile, keep the Library root but hide all sub-segments (tags/articles)
                if (!isRoot && hasChildren) return false;
            } else {
                // On desktop/tablet, hide the Library root to focus on the selection hierarchy
                if (isRoot && hasChildren) return false;
            }
        }
        return true;
    });
    breadcrumbItems = breadcrumbItems.map((item, index, list) => {
        const { id: _id, url, ...props } = item;
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
                    {!!bar && <span><SidebarIcon /></span>}
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

