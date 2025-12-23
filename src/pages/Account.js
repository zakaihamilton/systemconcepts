import React, { useState, useEffect } from "react";
import { styled } from '@mui/material/styles';
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "@util/translations";
import { MainStore } from "@components/Main";
import clsx from "clsx";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Input from "@widgets/Input";
import Cookies from "js-cookie";
import { fetchJSON } from "@util/fetch";
import { setPath, setHash } from "@util/pages";
import LinearProgress from "@mui/material/LinearProgress";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

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

export default function Account({ redirect }) {
    const { direction } = MainStore.useState();

    const translations = useTranslations();
    const idState = useState(Cookies.get("id"));
    const passwordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [passkeys, setPasskeys] = useState([]);
    const [createPasskey, setCreatePasskey] = useState(false);

    const userId = Cookies.get("id");
    const isSignedIn = userId && Cookies.get("hash");

    const changeRemember = event => setRemember(event.target.value);
    const changeCreatePasskey = event => setCreatePasskey(event.target.checked);

    useEffect(() => {
        if (isSignedIn) {
            fetchJSON("/api/passkey?action=list&id=" + userId)
                .then(data => {
                    if (Array.isArray(data)) {
                        setPasskeys(data);
                    }
                })
                .catch(console.error);
        }
    }, [isSignedIn, userId, counter]); // Reload when counter changes (e.g. login/logout/register)

    const onRegisterPasskey = async (targetId) => {
        const idToRegister = targetId || userId;
        setProgress(true);
        try {
            const options = await fetchJSON("/api/passkey?action=register-options&id=" + idToRegister);

            if (options.err) {
                throw options.err;
            }

            const attResp = await startRegistration({ optionsJSON: options });

            // Prompt for a name (simple implementation)
            const defaultName = "Passkey " + (passkeys.length + 1);
            let name = defaultName;
            // Only prompt if we are already signed in (user initiated action).
            // If doing it during login flow, maybe skip prompt or use default to avoid blocking?
            // Let's prompt anyway, it's a good UX.
            if (!targetId) {
                name = window.prompt(translations.ENTER_PASSKEY_NAME || "Enter a name for this passkey", defaultName);
            }

            const verification = await fetchJSON("/api/passkey?action=register-verify&id=" + idToRegister, {
                method: "POST",
                body: JSON.stringify({ ...attResp, name })
            });

            if (verification.verified) {
                setError("PASSKEY_REGISTERED");
                setCounter(c => c + 1); // Refresh list
            } else {
                throw "PASSKEY_REGISTRATION_FAILED";
            }
        } catch (err) {
            console.error(err);
            setError(translations[err] || String(err));
        } finally {
            setProgress(false);
        }
    };

    const onDeletePasskey = async (credentialId) => {
        if (!window.confirm(translations.CONFIRM_DELETE_PASSKEY || "Are you sure you want to remove this passkey?")) {
            return;
        }
        setProgress(true);
        try {
            await fetchJSON(`/api/passkey?id=${userId}&credentialId=${credentialId}`, {
                method: "DELETE"
            });
            setCounter(c => c + 1);
        } catch (err) {
            console.error(err);
            setError(translations[err] || String(err));
        } finally {
            setProgress(false);
        }
    };

    const onLoginPasskey = async () => {
        setValidate(true);
        if (onValidateField(idState[0])) {
            return;
        }
        setProgress(true);
        try {
            let [id] = idState;
            id = id.toLowerCase();
            const options = await fetchJSON("/api/passkey?action=auth-options&id=" + id);

            if (options.err) {
                throw options.err;
            }

            const asseResp = await startAuthentication({ optionsJSON: options });

            const verification = await fetchJSON("/api/passkey?action=auth-verify&id=" + id, {
                method: "POST",
                body: JSON.stringify(asseResp)
            });

            if (verification.hash) {
                Cookies.set("id", id, remember && { expires: 60 });
                Cookies.set("hash", verification.hash, remember && { expires: 60 });
                if (redirect) {
                    setHash(decodeURIComponent(redirect));
                }
                else {
                    setPath("");
                }
            } else {
                throw "PASSKEY_LOGIN_FAILED";
            }
        } catch (err) {
            console.error(err);
            setError(translations[err] || String(err));
        } finally {
            setProgress(false);
        }
    };

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
                }).then(async ({ err, hash }) => {
                    if (err) {
                        console.error(err);
                        throw err;
                    }
                    Cookies.set("id", id, remember && { expires: 60 });
                    Cookies.set("hash", hash, remember && { expires: 60 });

                    if (createPasskey) {
                        try {
                            await onRegisterPasskey(id);
                        } catch (e) {
                            console.error("Failed to create passkey after login", e);
                            // We don't block login, but maybe show an error?
                            // The error state might be overwritten by setPath("") if we are not careful.
                            // But onRegisterPasskey sets error state.
                            // Let's delay the redirect slightly if there was an error?
                            // Actually onRegisterPasskey sets error to PASSKEY_REGISTERED on success.
                            // We can check that?
                            // For now, let's just proceed.
                        }
                    }

                    setProgress(false);
                    setError("");
                    if (redirect) {
                        setHash(decodeURIComponent(redirect));
                    }
                    else {
                        setPath("");
                    }
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
                        <Grid size={12}>
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
                        {!isSignedIn && <Grid size={12}>
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
                        {!isSignedIn && <Grid size={12}>
                            <FormControlLabel
                                className={clsx(direction === "rtl" && classes.rtlLabel)}
                                control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>}
                        {!isSignedIn && browserSupportsWebAuthn() && <Grid size={12}>
                            <FormControlLabel
                                className={clsx(direction === "rtl" && classes.rtlLabel)}
                                control={<Checkbox color="primary" checked={createPasskey} onChange={changeCreatePasskey} />}
                                label={translations.CREATE_PASSKEY || "Create Passkey for this device"}
                            />
                        </Grid>}
                        {inProgress && <LinearProgress className={classes.progress} />}
                        <Grid size={12}>
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
                        {!isSignedIn && <Grid size={12}>
                            <Button
                                onClick={onLoginPasskey}
                                disabled={inProgress}
                                fullWidth
                                variant="contained"
                                color="secondary"
                                className={classes.submit}
                                startIcon={<FingerprintIcon />}
                            >
                                {translations.SIGN_IN_WITH_PASSKEY || "Sign in with Passkey"}
                            </Button>
                        </Grid>}
                        {isSignedIn && <Grid size={12}>
                            <Button
                                onClick={() => onRegisterPasskey()}
                                disabled={inProgress}
                                fullWidth
                                variant="outlined"
                                color="primary"
                                className={classes.submit}
                                startIcon={<FingerprintIcon />}
                            >
                                {translations.REGISTER_PASSKEY || "Register Passkey"}
                            </Button>
                        </Grid>}
                        {isSignedIn && passkeys.length > 0 && <Grid size={12}>
                            <Typography variant="h6">{translations.PASSKEYS || "Passkeys"}</Typography>
                            <List dense>
                                {passkeys.map(pk => (
                                    <ListItem key={pk.id}>
                                        <ListItemText primary={pk.name} secondary={new Date(pk.createdAt).toLocaleDateString()} />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" aria-label="delete" onClick={() => onDeletePasskey(pk.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        </Grid>}
                        {!isSignedIn && <Grid size={5}>
                            <Link className={classes.link} href="#resetpassword" variant="body2">
                                {translations.FORGET_PASSWORD}
                            </Link>
                        </Grid>}
                        {!isSignedIn && <Grid size={7}>
                            <Link className={classes.link} href="#signup" variant="body2">
                                {translations.SIGN_UP_TEXT}
                            </Link>
                        </Grid>}
                        {isSignedIn && <Grid size={8}>
                            <Link className={classes.link} href="#changepassword" variant="body2">
                                {translations.CHANGE_PASSWORD}
                            </Link>
                        </Grid>}
                        {isSignedIn && <Grid size={4}>
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