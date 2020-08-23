import React, { useState, useEffect } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import { useTranslations } from "@/util/translations";
import EmailIcon from '@material-ui/icons/Email';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import { InputAdornment } from "@material-ui/core";
import { fetchJSON } from "@/util/fetch";
import Cookies from 'js-cookie';
import Input from "@/widgets/Input";

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
    },
    form: {
        width: '100%', // Fix IE 11 issue.
        marginTop: theme.spacing(3),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
    adornment: {
        pointerEvents: "none"
    },
    input: {
        paddingLeft: "0.5em"
    },
    error: {
        color: "var(--error-color)",
        backgroundColor: "var(--error-background)",
        borderRadius: "0.3em",
        padding: "0.5em",
        margin: "0.5em",
        width: "100%",
        textAlign: "center"
    }
}));

export default function SignUp() {
    const classes = useStyles();
    const translations = useTranslations();

    const firstNameState = useState("");
    const lastNameState = useState("");
    const emailState = useState("");
    const passwordState = useState("");

    const [validate, setValidate] = useState(false);
    const [error, setError] = useState(false);

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

    const onValidateName = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        return error;
    };

    const isInvalid = validate && (
        onValidateEmail(emailState[0]) ||
        onValidatePassword(passwordState[0]) ||
        onValidateName(firstNameState[0]) ||
        onValidateName(lastNameState[0])
    );

    /*useEffect(() => {
        if (!firstNameError && !lastNameError && !emailError && !passwordError && submit) {
            setSubmit(false);
            fetchJSON("/register", {
                headers: {
                    firstName,
                    lastName,
                    email,
                    password
                }
            }).then(({ hash }) => {
                Cookies.set("email", email);
                Cookies.set("hash", hash);
                Cookies.set("firstName", firstName);
                Cookies.set("lastName", lastName);
            }).catch(err => {
                Cookies.set("email", "");
                Cookies.set("hash", "");
                setError(translations[err] || err);
            });
        }
    }, [firstNameError, lastNameError, emailError, passwordError, submit]);*/

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    {translations.SIGN_UP}
                </Typography>
                {error && <Typography variant="h6" className={classes.error}>
                    {error}
                </Typography>}
                <form className={classes.form} noValidate>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Input
                                state={firstNameState}
                                required
                                name="fname"
                                label={translations.FIRST_NAME}
                                id="fname"
                                autoComplete="fname"
                                validate={validate}
                                onValidate={onValidateName}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Input
                                state={lastNameState}
                                required
                                name="lname"
                                label={translations.LAST_NAME}
                                id="lname"
                                autoComplete="lname"
                                validate={validate}
                                onValidate={onValidateName}
                            />
                        </Grid>
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
                    </Grid>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        disabled={isInvalid}
                        onClick={onSubmit}
                    >
                        {translations.SIGN_UP}
                    </Button>
                    <Grid container justify="flex-end">
                        <Grid item>
                            <Link href="#signin" variant="body2">
                                {translations.HAVE_ACCOUNT}
                            </Link>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </Container>
    );
}