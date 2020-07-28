import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        alignItems: "center",
        marginLeft: "0.5em",
        marginRight: "0.5em",
        borderBottom: "1px solid var(--main-border)",
        '& > * + *': {
            marginTop: theme.spacing(2),
        },
    },
    link: {
        display: "flex",
        alignItems: "center"
    },
    icon: {
        marginBottom: "0.1em",
        marginRight: theme.spacing(0.5),
        width: "24px",
        height: "24px"
    }
}));

export function BreadcrumbItem({ name, icon, href, isLink }) {
    const classes = useStyles();
    const Icon = icon;
    if (!isLink) {
        return <Typography className={classes.link} color="textPrimary">
            {Icon && <Icon className={classes.icon} />}
            {name}
        </Typography>;
    }
    return <Link className={classes.link} color="inherit" href={href}>
        {Icon && <Icon className={classes.icon} />}
        {name}
    </Link>;
}

export default function BreadcrumbsWidget({ items }) {
    const classes = useStyles();
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

    return (
        <div className={classes.root}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                {breadcrumbItems}
            </Breadcrumbs>
        </div>
    );
}
