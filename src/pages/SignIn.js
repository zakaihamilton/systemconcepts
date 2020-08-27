import React, { useState } from 'react';
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
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import Input from "@/widgets/Input";
import Cookies from 'js-cookie';
import { fetchJSON } from "@/util/fetch";
import { setPath } from "@/util/pages";
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
        width: '100%',
        marginTop: theme.spacing(2),
    },
    rtlLabel: {
        marginRight: "-11px",
        marginLeft: "16px"
    },
    submit: {
        margin: theme.spacing(0.5, 0, 2),
        display: "flex"
    },
    progress: {
        width: "100%"
    },
    link: {
        whiteSpace: "nowrap"
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

export default function SignIn() {
    const { direction } = MainStore.useState();
    const classes = useStyles();
    const translations = useTranslations();
    const idState = useState(Cookies.get("id"));
    const passwordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState(false);
    const [inProgress, setProgress] = useState(false);

    const isSignedIn = Cookies.get("id") && Cookies.get("hash");

    const changeRemember = event => setRemember(event.target.value);

    const onSubmit = () => {
        if (isSignedIn) {
            Cookies.set("id", "");
            Cookies.set("hash", "");
            idState[1]("");
            setCounter(counter => counter + 1);
        }
        else {
            setValidate(true);
            if (!invalidFields && !inProgress) {
                const [id] = idState;
                const [password] = passwordState;
                setProgress(true);
                fetchJSON("/api/login", {
                    headers: {
                        id,
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
        }
    };

    const onKeyDown = async event => {
        if (event.keyCode == 13) {
            onSubmit();
        }
    };

    const onValidateField = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
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

    const invalidFields =
        onValidateField(idState[0]) ||
        onValidatePassword(passwordState[0]);
    const isInvalid = validate && invalidFields;

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    {translations[isSignedIn ? "SIGNED_IN" : "SIGN_IN"]}
                </Typography>
                {error && <Typography variant="h6" className={classes.error}>
                    {error}
                </Typography>}
                <form className={classes.form} noValidate>
                    <Grid container spacing={1}>
                        <Grid item xs={12}>
                            <Input
                                state={idState}
                                required
                                id="username"
                                label={translations.ID}
                                name="username"
                                autoComplete="username"
                                validate={validate}
                                readOnly={isSignedIn}
                                onValidate={onValidateField}
                                autoFocus
                                icon={<AccountCircleIcon />}
                            />
                        </Grid>
                        {!isSignedIn && <Grid item xs={12}>
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
                        </Grid>}
                        {!isSignedIn && <Grid item xs={12}>
                            <FormControlLabel
                                className={clsx(direction === "rtl" && classes.rtlLabel)}
                                control={<Checkbox value="remember" color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>}
                        {inProgress && <LinearProgress className={classes.progress} />}
                        <Grid item xs={12}>
                            <Button
                                onClick={onSubmit}
                                disabled={isInvalid || inProgress}
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={classes.submit}
                            >
                                {translations[isSignedIn ? "SIGN_OUT" : "SIGN_IN"]}
                            </Button>
                        </Grid>
                        {!isSignedIn && <Grid item xs={5}>
                            <Link className={classes.link} href="#settings/resetpassword" variant="body2">
                                {translations.FORGET_PASSWORD}
                            </Link>
                        </Grid>}
                        {!isSignedIn && <Grid item xs={7}>
                            <Link className={classes.link} href="#settings/signup" variant="body2">
                                {translations.SIGN_UP_TEXT}
                            </Link>
                        </Grid>}
                        {isSignedIn && <Grid item xs={5}>
                            <Link className={classes.link} href="#settings/changepassword" variant="body2">
                                {translations.CHANGE_PASSWORD}
                            </Link>
                        </Grid>}
                    </Grid>
                </form>
            </div>
        </Container>
    );
}