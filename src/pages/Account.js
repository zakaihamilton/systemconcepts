import React, { useState } from "react";
import { styled } from '@mui/material/styles';
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { useTranslations } from "@util/translations";
import { MainStore } from "@components/Main";
import clsx from "clsx";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Input from "@widgets/Input";
import Cookies from "js-cookie";
import { fetchJSON } from "@util/fetch";
import { setPath } from "@util/pages";
import LinearProgress from "@mui/material/LinearProgress";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

const PREFIX = 'Account';

const classes = {
    paper: `${PREFIX}-paper`,
    form: `${PREFIX}-form`,
    rtlLabel: `${PREFIX}-rtlLabel`,
    submit: `${PREFIX}-submit`,
    progress: `${PREFIX}-progress`,
    link: `${PREFIX}-link`,
    error: `${PREFIX}-error`
};

const StyledContainer = styled(Container)((
    {
        theme
    }
) => ({
    [`& .${classes.paper}`]: {
        marginTop: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },

    [`& .${classes.form}`]: {
        width: "100%",
        marginTop: theme.spacing(2),
    },

    [`& .${classes.rtlLabel}`]: {
        marginRight: "-11px",
        marginLeft: "16px"
    },

    [`& .${classes.submit}`]: {
        margin: theme.spacing(0.5, 0, 2),
        display: "flex"
    },

    [`& .${classes.progress}`]: {
        width: "100%"
    },

    [`& .${classes.link}`]: {
        whiteSpace: "nowrap"
    },

    [`& .${classes.error}`]: {
        color: "var(--error-color)",
        backgroundColor: "var(--error-background)",
        borderRadius: "0.3em",
        padding: "0.5em",
        margin: "0.5em",
        width: "100%",
        textAlign: "center"
    }
}));

export default function Account() {
    const { direction } = MainStore.useState();

    const translations = useTranslations();
    const idState = useState(Cookies.get("id"));
    const passwordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState(false);
    const [inProgress, setProgress] = useState(false);

    const userId = Cookies.get("id");
    const isSignedIn = userId && Cookies.get("hash");

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
                let [id] = idState;
                const [password] = passwordState;
                id = id.toLowerCase();
                setProgress(true);
                fetchJSON("/api/login", {
                    headers: {
                        id,
                        password: encodeURIComponent(password)
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
        (<StyledContainer component="main" maxWidth="xs">
            <div className={classes.paper}>
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
                                control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
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
                            <Link className={classes.link} href="#resetpassword" variant="body2">
                                {translations.FORGET_PASSWORD}
                            </Link>
                        </Grid>}
                        {!isSignedIn && <Grid item xs={7}>
                            <Link className={classes.link} href="#signup" variant="body2">
                                {translations.SIGN_UP_TEXT}
                            </Link>
                        </Grid>}
                        {isSignedIn && <Grid item xs={8}>
                            <Link className={classes.link} href="#changepassword" variant="body2">
                                {translations.CHANGE_PASSWORD}
                            </Link>
                        </Grid>}
                        {isSignedIn && <Grid item xs={4}>
                            <Link className={classes.link} href={"#account/" + encodeURIComponent(`user/${userId}`)} variant="body2">
                                {translations.EDIT_ACCOUNT}
                            </Link>
                        </Grid>}
                    </Grid>
                </form>
            </div>
        </StyledContainer>)
    );
}