import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import { Divider } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column"
    },
    breadcrumbs: {
        display: "flex",
        alignItems: "center",
        flex: "1",
        paddingLeft: "0.5em",
        paddingRight: "0.5em",
        '& > * + *': {
            marginTop: theme.spacing(2),
        }
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

export function BreadcrumbItem({ name, Icon, href, isLink }) {
    const classes = useStyles();
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
            <Breadcrumbs className={classes.breadcrumbs} eparator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                {breadcrumbItems}
            </Breadcrumbs>
            <Divider />
        </div>
    );
}
