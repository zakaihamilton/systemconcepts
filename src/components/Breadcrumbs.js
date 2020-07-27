import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';

const useStyles = makeStyles((theme) => ({
    root: {
        borderBottom: "1px solid var(--main-border)",
        '& > * + *': {
            marginTop: theme.spacing(2),
        },
    },
}));

export function BreadcrumbItem({ name, href, isLink, onClick }) {
    if (!isLink) {
        return <Typography color="textPrimary">{name}</Typography>;
    }
    return <Link color="inherit" href={href} onClick={onClick}>
        {name}
    </Link>;
}

export default function BreadcrumbsWidget({ items }) {
    const classes = useStyles();

    const breadcrumbItems = (items || []).map((item, index, list) => {
        const isLink = index === list.length - 1;
        const { id, ...props } = item;

        return <BreadcrumbItem key={id} isLink={isLink} {...props} />
    });

    return (
        <div className={classes.root}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                {breadcrumbItems}
            </Breadcrumbs>
        </div>
    );
}
