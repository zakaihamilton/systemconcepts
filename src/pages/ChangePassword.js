import React, { useState } from "react";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import makeStyles from '@mui/styles/makeStyles';
import Container from "@mui/material/Container";
import { useTranslations } from "@util/translations";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { fetchJSON } from "@util/fetch";
import Cookies from "js-cookie";
import Input from "@widgets/Input";
import { setPath } from "@util/pages";
import FormControlLabel from "@mui/material/FormControlLabel";
import clsx from "clsx";
import { MainStore } from "@components/Main";
import Checkbox from "@mui/material/Checkbox";
import LinearProgress from "@mui/material/LinearProgress";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    form: {
        width: "100%", // Fix IE 11 issue.
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

export default function ChangePassword() {
    const { direction } = MainStore.useState();
    const classes = useStyles();
    const translations = useTranslations();
    const idState = useState(Cookies.get("id"));
    const oldPasswordState = useState("");
    const newPasswordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

    const changeRemember = event => setRemember(event.target.value);

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
        onValidatePassword(oldPasswordState[0]) ||
        onValidatePassword(newPasswordState[0]) ||
        onValidateField(idState[0]);
    const isInvalid = validate && invalidFields;

    const onSubmit = () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            const [id] = idState;
            const [oldPassword] = oldPasswordState;
            const [newPassword] = newPasswordState;
            setProgress(true);
            fetchJSON("/api/login", {
                method: "PUT",
                headers: {
                    id,
                    oldpassword: encodeURIComponent(oldPassword),
                    newpassword: encodeURIComponent(newPassword)
                }
            }).then(({ err, hash }) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                Cookies.set("hash", hash, remember && { expires: 60 });
                setProgress(false);
                setError("");
                setPath("");
            }).catch(err => {
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
            <div className={classes.paper}>
                <Typography component="h1" variant="h5">
                    {translations.CHANGE_PASSWORD}
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
                                readOnly={Cookies.get("id")}
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
                        <Grid item xs={12}>
                            <Input
                                state={oldPasswordState}
                                required
                                name="oldpassword"
                                label={translations.OLD_PASSWORD}
                                type="password"
                                id="password"
                                autoComplete="current-password"
                                validate={validate}
                                onValidate={onValidatePassword}
                                icon={<VpnKeyIcon />}
                                onKeyDown={onKeyDown}
                            />

                        </Grid>
                        <Grid item xs={12}>
                            <Input
                                state={newPasswordState}
                                required
                                name="newpassword"
                                label={translations.NEW_PASSWORD}
                                type="password"
                                id="newpassword"
                                autoComplete="new-password"
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
                            control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
                            label={translations.REMEMBER_ME}
                        />
                    </Grid>
                    {inProgress && <LinearProgress className={classes.progress} />}
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        disabled={!!(isInvalid || inProgress)}
                        onClick={onSubmit}
                    >
                        {translations.CHANGE_PASSWORD}
                    </Button>
                </form>
            </div>
        </Container>
    );
}