import { useState } from "react";
import { useTranslations } from "@util/translations";
import EmailIcon from "@mui/icons-material/Email";
import Input from "@widgets/Input";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import clsx from "clsx";
import { goBackPage } from "@util/pages";
import roles from "@data/roles";
import { useFetchJSON, fetchJSON } from "@util/fetch";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import RecentActorsIcon from "@mui/icons-material/RecentActors";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useParentPath } from "@util/pages";
import { MainStore } from "@components/Main";
import styles from "./User.module.scss";

export default function User({ path = "" }) {
    const { direction } = MainStore.useState();
    const translations = useTranslations();
    const parentPath = useParentPath();
    const editAccount = parentPath === "#account";
    const [data, setData, loading] = useFetchJSON("/api/users", { headers: { id: path } });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

    const roleTypeMapping = item => {
        return {
            ...item,
            name: translations[item.name]
        };
    };

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

    const invalidFields = !data ||
        onValidateEmail(data.email) ||
        onValidateField(data.firstName) ||
        onValidateField(data.lastName) ||
        onValidateId(data.id);
    const isInvalid = validate && invalidFields;

    const onSubmit = () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            setProgress(true);
            fetchJSON("/api/users", {
                method: "PUT",
                headers: { id: data.id },
                body: JSON.stringify(data)
            }).then(({ err }) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                goBackPage();
                setProgress(false);
                setError("");
            }).catch(err => {
                setError(translations[err] || String(err));
                setProgress(false);
            });
        }
    };

    const onCancel = () => {
        goBackPage();
    };

    const getState = (id) => {
        const value = data && data[id];
        const setValue = (value) => {
            setData(prev => ({ ...prev, [id]: value }));
        };
        return [value, setValue];
    };

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                {(loading || inProgress) && <LinearProgress className={styles.progress} />}
                <div className={styles.header}>
                    <Tooltip title={translations.BACK} arrow>
                        <IconButton className={clsx(styles.backButton, direction === "rtl" && styles.rtl)} onClick={onCancel}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography component="h1" className={styles.title}>
                        {translations[editAccount ? "EDIT_ACCOUNT" : "USER"]}
                    </Typography>
                </div>
                {error && <Typography className={styles.error}>
                    {error}
                </Typography>}
                <div className={styles.form}>
                    <Grid container spacing={2}>
                        {!editAccount && <Grid size={12}>
                            <Input
                                id="id"
                                state={getState("id")}
                                label={translations.ID}
                                onValidate={onValidateId}
                                validate={validate}
                                icon={<AccountCircleIcon />}
                                background={true}
                            />
                        </Grid>}
                        <Grid size={12}>
                            <Input
                                id="email"
                                state={getState("email")}
                                label={translations.EMAIL_ADDRESS}
                                icon={<EmailIcon />}
                                onValidate={onValidateEmail}
                                validate={validate}
                                background={true}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Input
                                id="firstName"
                                state={getState("firstName")}
                                label={translations.FIRST_NAME}
                                onValidate={onValidateField}
                                validate={validate}
                                background={true}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Input
                                id="lastName"
                                state={getState("lastName")}
                                label={translations.LAST_NAME}
                                onValidate={onValidateField}
                                validate={validate}
                                background={true}
                            />
                        </Grid>
                        {!editAccount && <Grid size={12}>
                            <Input
                                id="role"
                                state={getState("role")}
                                icon={<RecentActorsIcon />}
                                label={translations.ROLE}
                                items={roles}
                                mapping={roleTypeMapping}
                                select={true}
                                background={true}
                            />
                        </Grid>}
                        {!editAccount && <Grid size={12}>
                            <Input
                                id="password"
                                state={getState("password")}
                                icon={<VpnKeyIcon />}
                                label={translations.PASSWORD}
                                type="password"
                                background={true}
                                onValidate={onValidatePassword}
                                validate={validate}
                                autoComplete="new-password"
                            />
                        </Grid>}
                    </Grid>
                </div>
                <div className={styles.actions}>
                    <Button
                        onClick={onSubmit}
                        variant="contained"
                        color="primary"
                        className={clsx(styles.submit, styles.actionButton)}
                        disabled={!!(isInvalid || inProgress || !data)}
                    >
                        {translations.SAVE}
                    </Button>
                    <Button
                        onClick={onCancel}
                        variant="contained"
                        className={clsx(styles.secondaryButton, styles.actionButton)}
                    >
                        {translations.CANCEL}
                    </Button>
                </div>
            </div>
        </div>
    );
}
