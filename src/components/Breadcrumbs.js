import React from 'react';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import { Divider } from "@material-ui/core";
import IconButton from "@/components/Widgets/IconButton";
import { MainStore } from "@/components/Main";
import styles from "./Breadcrumbs.module.scss";
import clsx from "clsx";
import { useDeviceType } from "@/util/styles";
import Tooltip from '@material-ui/core/Tooltip';

export function BreadcrumbItem({ index, count, name, Icon, href, isLast }) {
    const { direction } = MainStore.useState();
    const deviceType = useDeviceType();
    const SeparatorIcon = direction === "rtl" ? NavigateBeforeIcon : NavigateNextIcon;
    const className = clsx(styles.link, isLast && styles.last);
    const showName =
        deviceType === "phone" && (count <= 2 || index === count - 1) ||
        deviceType === "tablet" && (count <= 3 || index === count - 1) ||
        deviceType === "desktop" && (count <= 5 || index === count - 1);
    return <>
        <Link className={className} color="inherit" href={href}>
            {Icon && <IconButton className={styles.iconButton}>
                <Tooltip arrow title={showName ? "" : name}>
                    <Icon className={styles.icon} />
                </Tooltip>
            </IconButton>}
            {showName && <div className={styles.name}>
                {name}
            </div>}
        </Link>
        {!isLast && <SeparatorIcon className={styles.separator} fontSize="small" />}
    </>;
}

export default function BreadcrumbsWidget({ items }) {
    let href = "#";

    const breadcrumbItems = (items || []).map((item, index, list) => {
        const isLast = index === list.length - 1;
        const { id, url, ...props } = item;
        if (href.length > 1) {
            href += "/";
        }
        href += url;
        return <BreadcrumbItem key={id} index={index} count={list.length} isLast={isLast} href={href} {...props} />
    });


    return (
        <div className={styles.root}>
            <div className={styles.breadcrumbs}>
                {breadcrumbItems}
            </div>
            <Divider />
        </div>
    );
}
