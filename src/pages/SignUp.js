import React, { useState } from "react";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useTranslations } from "@util/translations";
import EmailIcon from "@mui/icons-material/Email";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { fetchJSON } from "@util/fetch";
import Cookies from "js-cookie";
import Input from "@widgets/Input";
import { setPath, setHash } from "@util/pages";
import FormControlLabel from "@mui/material/FormControlLabel";
import clsx from "clsx";
import { MainStore } from "@components/Main";
import Checkbox from "@mui/material/Checkbox";
import LinearProgress from "@mui/material/LinearProgress";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import styles from "./Account.module.scss";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

export default function SignUp() {
    const { direction } = MainStore.useState();

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
        const emailPattern = /[a-zA-Z0-9]+[\.]?([a-zA-Z0-9]+)?[\@][a-z]{3,25}[\.][a-z]{2,5}/g;
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

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        else if (!text.match(/^[a-z0-9\-_]+$/i)) {
            error = translations.BAD_ID;
        }
        return error;
    };

    const invalidFields =
        onValidateEmail(emailState[0]) ||
        onValidatePassword(passwordState[0]) ||
        onValidateField(firstNameState[0]) ||
        onValidateField(lastNameState[0]) ||
        onValidateId(idState[0]);
    const isInvalid = validate && invalidFields;

    const onSubmit = (event) => {
        if (event) {
            event.preventDefault();
        }
        setValidate(true);
        if (!invalidFields && !inProgress) {
            const [id] = idState;
            const [firstName] = firstNameState;
            const [lastName] = lastNameState;
            const [email] = emailState;
            const [password] = passwordState;
            setProgress(true);
            fetchJSON("/api/login", {
                method: "PUT",
                headers: {
                    id,
                    first_name: encodeURIComponent(firstName),
                    last_name: encodeURIComponent(lastName),
                    email,
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
    };

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                {inProgress && <LinearProgress className={styles.progress} />}
                <div className={styles.header}>
                    <Tooltip title={translations.BACK} arrow>
                        <IconButton className={clsx(styles.backButton, direction === "rtl" && styles.rtl)} onClick={() => setHash("account")}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography component="h1" className={styles.title}>
                        {translations.SIGN_UP}
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
                                autoComplete="username"
                                helperText={translations.ID_DESCRIPTION}
                                validate={validate}
                                onValidate={onValidateId}
                                autoFocus
                                icon={<AccountCircleIcon />}
                                background={true}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Input
                                state={firstNameState}
                                required
                                name="fname"
                                label={translations.FIRST_NAME}
                                id="fname"
                                autoComplete="fname"
                                validate={validate}
                                onValidate={onValidateField}
                                background={true}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Input
                                state={lastNameState}
                                required
                                name="lname"
                                label={translations.LAST_NAME}
                                id="lname"
                                autoComplete="lname"
                                validate={validate}
                                onValidate={onValidateField}
                                background={true}
                            />
                        </Grid>
                        <Grid size={12}>
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
                                background={true}
                            />
                        </Grid>
                        <Grid size={12}>
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
                        </Grid>
                        <Grid size={12}>
                            <FormControlLabel
                                className={clsx(styles.checkboxLabel, direction === "rtl" && styles.rtlLabel)}
                                control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>
                        <Grid size={12}>
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                color="primary"
                                className={styles.submit}
                                disabled={!!(isInvalid || inProgress)}
                            >
                                {translations.SIGN_UP}
                            </Button>
                        </Grid>
                        <div className={styles.links}>
                            <Link href="#signin">
                                {translations.HAVE_ACCOUNT}
                            </Link>
                        </div>
                    </Grid>
                </form>
            </div>
        </div>
    );
}