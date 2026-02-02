import { useState } from "react";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { useTranslations } from "@util/translations";
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

export default function ResetPassword({ path = "" }) {
    const { direction } = MainStore.useState();

    const translations = useTranslations();
    const idState = useState(Cookies.get("id"));
    const newPasswordState = useState("");
    const [remember, setRemember] = useState(true);
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const code = path;
    const hasCode = !!code;

    const changeRemember = event => setRemember(event.target.value);

    const onValidatePassword = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_PASSWORD;
        }
        else if (text.length < 8) {
            error = translations.PASSWORD_TOO_SHORT;
        }
        else if (text.length > 72) {
            error = translations.PASSWORD_TOO_LONG;
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
        (hasCode && onValidatePassword(newPasswordState[0])) ||
        onValidateField(idState[0]);
    const isInvalid = validate && invalidFields;

    const onSubmit = () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            const [id] = idState;
            const [newPassword] = newPasswordState;
            setProgress(true);
            fetchJSON("/api/login", {
                method: "PUT",
                headers: {
                    id,
                    ...(!hasCode && { reset: true }),
                    ...(hasCode && {
                        newpassword: encodeURIComponent(newPassword),
                        code
                    })
                }
            }).then(({ err, hash }) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                if (hasCode) {
                    Cookies.set("hash", hash, remember && { expires: 60 });
                    setProgress(false);
                    setError("");
                    setEmailSent(false);
                    setPath("");
                }
                else {
                    setEmailSent(true);
                    setProgress(false);
                    setError("");
                    setValidate(false);
                }
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
        <div className={styles.root}>
            <div className={styles.card}>
                {inProgress && <LinearProgress className={styles.progress} />}
                <div className={styles.header}>
                    <Tooltip title={translations.BACK} arrow>
                        <IconButton
                            className={clsx(styles.backButton, direction === "rtl" && styles.rtl)}
                            onClick={() => setHash("account")}
                            aria-label={translations.BACK}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography component="h1" className={styles.title}>
                        {hasCode ? translations.CHANGE_PASSWORD : translations.RESET_PASSWORD}
                    </Typography>
                </div>
                {error && <Typography className={styles.error}>
                    {error}
                </Typography>}
                {emailSent && !hasCode && <Typography className={styles.notification}>
                    {translations.RESET_EMAIL_SENT}
                </Typography>}
                <div className={styles.form}>
                    <Grid container spacing={2}>
                        <Grid size={12}>
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
                                background={true}
                            />
                        </Grid>
                        {hasCode && <Grid size={12}>
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
                                background={true}
                            />
                        </Grid>}
                        {hasCode && <Grid size={12}>
                            <FormControlLabel
                                className={clsx(styles.checkboxLabel, direction === "rtl" && styles.rtlLabel)}
                                control={<Checkbox color="primary" value={remember} onChange={changeRemember} />}
                                label={translations.REMEMBER_ME}
                            />
                        </Grid>}
                        <Grid size={12}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={styles.submit}
                                disabled={!!(isInvalid || inProgress || (emailSent && !hasCode))}
                                onClick={onSubmit}
                            >
                                {hasCode ? translations.CHANGE_PASSWORD : translations.RESET_PASSWORD}
                            </Button>
                        </Grid>
                    </Grid>
                </div>
            </div>
        </div>
    );
}