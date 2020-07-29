import React from 'react';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import { Divider } from "@material-ui/core";
import { MainStore } from "@/components/Main";
import styles from "./Breadcrumbs.module.scss";

export function BreadcrumbItem({ name, Icon, href, isLink }) {
    if (!isLink) {
        return <Typography className={styles.link} color="textPrimary">
            {Icon && <Icon className={styles.icon} />}
            {name}
        </Typography>;
    }
    return <Link className={styles.link} color="inherit" href={href}>
        {Icon && <Icon className={styles.icon} />}
        {name}
    </Link>;
}

export default function BreadcrumbsWidget({ items }) {
    const { direction } = MainStore.useState();
    let href = "#";

    const breadcrumbItems = (items || []).map((item, index, list) => {
        const isLink = index !== list.length - 1;
        const { id, url, ...props } = item;
        if (href.length > 1) {
            href += "/";
        }
        href += url;
        return <BreadcrumbItem key={id} isLink={isLink} href={href} {...props} />
    });

    const Icon = direction === "rtl" ? NavigateBeforeIcon : NavigateNextIcon;

    return (
        <div className={styles.root}>
            <Breadcrumbs className={styles.breadcrumbs} separator={<Icon fontSize="small" />} aria-label="breadcrumb">
                {breadcrumbItems}
            </Breadcrumbs>
            <Divider />
        </div>
    );
}
