import React, { useState, useEffect } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import { useTranslations } from "@/util/translations";
import { MainStore } from "@/components/Main";
import clsx from "clsx";
import EmailIcon from '@material-ui/icons/Email';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import Input from "@/widgets/Input";

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(4),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
    },
    form: {
        width: '100%',
        marginTop: theme.spacing(2),
    },
    rtlLabel: {
        marginRight: "-11px",
        marginLeft: "16px"
    },
    link: {
        whiteSpace: "nowrap"
    }
}));

export default function SignIn() {
    const { direction } = MainStore.useState();
    const classes = useStyles();
    const translations = useTranslations();
    const emailState = useState("");
    const passwordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);

    const changeRemember = event => setRemember(event.target.value);

    const onSubmit = () => {
        setValidate(true);
    };

    const onValidateEmail = text => {
        let error = "";
        const emailPattern = /[a-zA-Z0-9]+[\.]?([a-zA-Z0-9]+)?[\@][a-z]{3,9}[\.][a-z]{2,5}/g;
        if (!text) {
            error = translations.EMPTY_EMAIL;
        }
        else if (!emailPattern.test(text)) {
            error = translations.BAD_EMAIL;
        }
        return error;
    };

    const onValidatePassword = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_PASSWORD;
        }
        return error;
    };

    const isInvalid = validate && (onValidateEmail(emailState[0]) || onValidatePassword(passwordState[0]));

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    {translations.SIGN_IN}
                </Typography>
                <form className={classes.form} noValidate>
                    <Grid container spacing={1}>
                        <Grid item xs={12}>
                            <Input
                                state={emailState}
                                required
                                id="email"
                                label={translations.EMAIL_ADDRESS}
                                name="email"
                                type="email"
                                autoComplete="email"
                                validate={validate}
                                onValidate={onValidateEmail}
                                autoFocus
                                icon={<EmailIcon />}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Input
                                state={passwordState}
                                required
                                name="password"
                                label={translations.PASSWORD}
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                validate={validate}
                                onValidate={onValidatePassword}
                                icon={<VpnKeyIcon />}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                className={clsx(direction === "rtl" && classes.rtlLabel)}
                                control={<Checkbox value="remember" color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button
                                onClick={onSubmit}
                                disabled={isInvalid}
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={classes.submit}
                            >
                                {translations.SIGN_IN}
                            </Button>
                        </Grid>
                        <Grid item xs={5}>
                            <Link className={classes.link} href="#" variant="body2">
                                {translations.FORGET_PASSWORD}
                            </Link>
                        </Grid>
                        <Grid item xs={7}>
                            <Link className={classes.link} href="#signup" variant="body2">
                                {translations.SIGN_UP_TEXT}
                            </Link>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </Container>
    );
}