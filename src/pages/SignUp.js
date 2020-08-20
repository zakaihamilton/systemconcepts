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

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(8),
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
}));

export default function SignUp() {
    const classes = useStyles();
    const translations = useTranslations();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstNameError, setFirstNameError] = useState("");
    const [lastNameError, setLastNameError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [validate, setValidate] = useState(false);

    const changeFirstName = event => setFirstName(event.target.value);
    const changeLastName = event => setLastName(event.target.value);
    const changeEmail = event => setEmail(event.target.value);
    const changePassword = event => setPassword(event.target.value);

    const actionDisabled = firstNameError || lastNameError || emailError || passwordError;

    useEffect(() => {
        if (!validate) {
            setEmailError("");
            setPasswordError("");
            setFirstNameError("");
            setLastNameError("");
            return;
        }
        if (!firstName) {
            setFirstNameError(translations.EMPTY_FIELD);
        }
        else {
            setFirstNameError("");
        }
        if (!lastName) {
            setLastNameError(translations.EMPTY_FIELD);
        }
        else {
            setLastNameError("");
        }
        const emailPattern = /[a-zA-Z0-9]+[\.]?([a-zA-Z0-9]+)?[\@][a-z]{3,9}[\.][a-z]{2,5}/g;
        if (!email) {
            setEmailError(translations.EMPTY_EMAIL);
        }
        else if (!emailPattern.test(email)) {
            setEmailError(translations.BAD_EMAIL);
        }
        else {
            setEmailError("");
        }
        if (!password) {
            setPasswordError(translations.EMPTY_PASSWORD);
        }
        else {
            setPasswordError("");
        }
    }, [firstName, lastName, password, email, validate]);

    const onSubmit = () => {
        setValidate(true);
    };

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
                <form className={classes.form} noValidate>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                autoComplete="fname"
                                name="firstName"
                                variant="outlined"
                                required
                                fullWidth
                                id="firstName"
                                label={translations.FIRST_NAME}
                                autoFocus
                                value={firstName}
                                onChange={changeFirstName}
                                error={firstNameError !== ""}
                                helperText={firstNameError}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                id="lastName"
                                label={translations.LAST_NAME}
                                name="lastName"
                                autoComplete="lname"
                                value={lastName}
                                onChange={changeLastName}
                                error={lastNameError !== ""}
                                helperText={lastNameError}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                id="email"
                                label={translations.EMAIL_ADDRESS}
                                name="email"
                                autoComplete="email"
                                value={email}
                                onChange={changeEmail}
                                error={emailError !== ""}
                                helperText={emailError}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                variant="outlined"
                                required
                                fullWidth
                                name="password"
                                label={translations.PASSWORD}
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={changePassword}
                                error={passwordError !== ""}
                                helperText={passwordError}
                            />
                        </Grid>
                    </Grid>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        onClick={onSubmit}
                        disabled={actionDisabled}
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