import React, { useState } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import { useTranslations } from "@/util/translations";
import EmailIcon from '@material-ui/icons/Email';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import { fetchJSON } from "@/util/fetch";
import Cookies from 'js-cookie';
import Input from "@/widgets/Input";
import { setPath } from "@/util/pages";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import clsx from "clsx";
import { MainStore } from "@/components/Main";
import Checkbox from '@material-ui/core/Checkbox';
import LinearProgress from "@material-ui/core/LinearProgress";
import AccountCircleIcon from '@material-ui/icons/AccountCircle';

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
    progress: {
        width: "100%"
    },
    submit: {
        margin: theme.spacing(0.5, 0, 2),
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
    const { direction } = MainStore.useState();
    const classes = useStyles();
    const translations = useTranslations();
    const idState = useState("");
    const firstNameState = useState("");
    const lastNameState = useState("");
    const emailState = useState("");
    const passwordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

    const changeRemember = event => setRemember(event.target.value);

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

    const onValidateField = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        return error;
    };

    const invalidFields =
        onValidateEmail(emailState[0]) ||
        onValidatePassword(passwordState[0]) ||
        onValidateField(firstNameState[0]) ||
        onValidateField(lastNameState[0]) ||
        onValidateField(idState[0]);
    const isInvalid = validate && invalidFields;

    const onSubmit = () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            const [id] = idState;
            const [firstName] = firstNameState;
            const [lastName] = lastNameState;
            const [email] = emailState;
            const [password] = passwordState;
            setProgress(true);
            fetchJSON("/api/register", {
                headers: {
                    id,
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    password
                }
            }).then(({ err, hash }) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                Cookies.set("id", id, remember && { expires: 60 });
                Cookies.set("hash", hash, remember && { expires: 60 });
                setProgress(false);
                setError("");
                setPath("");
            }).catch(err => {
                Cookies.set("id", "");
                Cookies.set("hash", "");
                setError(translations[err] || String(err));
                setProgress(false);
            });
        }
    };

    const onKeyDown = async event => {
        if (event.keyCode == 13) {
            onSubmit();
        }
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
                {error && <Typography variant="h6" className={classes.error}>
                    {error}
                </Typography>}
                <form className={classes.form} noValidate>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Input
                                state={idState}
                                required
                                id="userid"
                                label={translations.ID}
                                name="userid"
                                autoComplete="userid"
                                validate={validate}
                                onValidate={onValidateField}
                                autoFocus
                                icon={<AccountCircleIcon />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Input
                                state={firstNameState}
                                required
                                name="fname"
                                label={translations.FIRST_NAME}
                                id="fname"
                                autoComplete="fname"
                                validate={validate}
                                onValidate={onValidateField}
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
                                onValidate={onValidateField}
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
                                onKeyDown={onKeyDown}
                            />

                        </Grid>
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            className={clsx(direction === "rtl" && classes.rtlLabel)}
                            control={<Checkbox value="remember" color="primary" value={remember} onChange={changeRemember} />}
                            label={translations.REMEMBER_ME}
                        />
                    </Grid>
                    {inProgress && <LinearProgress className={classes.progress} />}
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        disabled={isInvalid || inProgress}
                        onClick={onSubmit}
                    >
                        {translations.SIGN_UP}
                    </Button>
                    <Grid container justify="flex-end">
                        <Grid item>
                            <Link href="#settings/signin" variant="body2">
                                {translations.HAVE_ACCOUNT}
                            </Link>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </Container>
    );
}