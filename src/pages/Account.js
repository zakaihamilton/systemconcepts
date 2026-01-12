import React, { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
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
import { clearBundleCache } from '@sync/sync';
import styles from "./Account.module.scss";
import storage from "@util/storage";
import { UpdateSessionsStore } from "@sync/syncState";

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
                if (verification.role) {
                    Cookies.set("role", verification.role, remember && { expires: 60 });
                }
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

    const onSubmit = async (event) => {
        if (event) {
            event.preventDefault();
        }
        if (isSignedIn) {
            // Clear cookies
            Cookies.set("id", "");
            Cookies.set("hash", "");
            Cookies.set("role", "");
            idState[1]("");

            // Clear bundle cache on logout
            await clearBundleCache();
            await storage.deleteFolder("local");

            UpdateSessionsStore.update(s => {
                s.busy = false; // Reset busy state to allow re-fetching
                s.status = [];
            });
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
                }).then(async (data) => {
                    const { err, hash } = data;
                    if (err) {
                        console.error(err);
                        throw err;
                    }
                    Cookies.set("id", id, remember && { expires: 60 });
                    Cookies.set("hash", hash, remember && { expires: 60 });
                    if (data.role) {
                        Cookies.set("role", data.role, remember && { expires: 60 });
                    }

                    if (createPasskey) {
                        try {
                            await onRegisterPasskey(id);
                        } catch (e) {
                            console.error("Failed to create passkey after login", e);
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
                    Cookies.set("role", "");
                    setError(translations[err] || String(err));
                    setProgress(false);
                });
            }
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
        <div className={styles.root}>
            <div className={styles.card}>
                {inProgress && <LinearProgress className={styles.progress} />}
                <div className={styles.header}>
                    <Typography component="h1" className={styles.title}>
                        {translations[isSignedIn ? "SIGNED_IN" : "SIGN_IN"]}
                    </Typography>
                </div>
                {error && <Typography className={styles.error}>
                    {error}
                </Typography>}
                <form className={styles.form} onSubmit={onSubmit} noValidate>
                    <Grid container spacing={2}>
                        <Grid size={12}>
                            <Input
                                state={idState}
                                required
                                id="username"
                                label={translations.ID}
                                name="username"
                                type="email"
                                autoComplete="username"
                                validate={validate}
                                readOnly={isSignedIn}
                                onValidate={onValidateField}
                                autoFocus
                                icon={<AccountCircleIcon />}
                                background={true}
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
                                background={true}
                            />
                        </Grid>}
                        {!isSignedIn && <Grid size={12}>
                            <FormControlLabel
                                className={clsx(styles.checkboxLabel, direction === "rtl" && styles.rtlLabel)}
                                control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>}
                        {!isSignedIn && browserSupportsWebAuthn() && <Grid size={12}>
                            <FormControlLabel
                                className={clsx(styles.checkboxLabel, direction === "rtl" && styles.rtlLabel)}
                                control={<Checkbox color="primary" checked={createPasskey} onChange={changeCreatePasskey} />}
                                label={translations.CREATE_PASSKEY || "Create Passkey for this device"}
                            />
                        </Grid>}
                        <Grid size={12}>
                            <Button
                                type="submit"
                                disabled={isInvalid || inProgress}
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={styles.submit}
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
                                className={styles.secondaryButton}
                                startIcon={<FingerprintIcon />}
                            >
                                {translations.SIGN_IN_WITH_PASSKEY}
                            </Button>
                        </Grid>}
                        {isSignedIn && <Grid size={12}>
                            <Button
                                onClick={() => onRegisterPasskey()}
                                disabled={inProgress}
                                fullWidth
                                variant="outlined"
                                color="primary"
                                className={styles.secondaryButton}
                                startIcon={<FingerprintIcon />}
                            >
                                {translations.REGISTER_PASSKEY}
                            </Button>
                        </Grid>}
                        {isSignedIn && passkeys.length > 0 && <Grid size={12}>
                            <Typography className={styles.passkeyTitle}>{translations.PASSKEYS}</Typography>
                            <List dense className={styles.passkeyList}>
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
                        <Grid size={12}>
                            <div className={styles.links}>
                                {!isSignedIn && (
                                    <>
                                        <Link href="#resetpassword">
                                            {translations.FORGET_PASSWORD}
                                        </Link>
                                        <Link href="#signup">
                                            {translations.SIGN_UP_TEXT}
                                        </Link>
                                    </>
                                )}
                                {isSignedIn && (
                                    <>
                                        <Link href="#changepassword">
                                            {translations.CHANGE_PASSWORD}
                                        </Link>
                                        <Link href={"#account/" + encodeURIComponent(`user/${userId}`)}>
                                            {translations.EDIT_ACCOUNT}
                                        </Link>
                                    </>
                                )}
                            </div>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </div>
    );
}