import React, { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import LinearProgress from "@mui/material/LinearProgress";
import Grid from "@mui/material/Grid";
import Cookies from "js-cookie";
import { useTranslations } from "@util/translations";
import { fetchJSON } from "@util/fetch";
import styles from "./Account.module.scss";

export default function ApiKeys() {
    const translations = useTranslations();
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [apiKeys, setApiKeys] = useState([]);

    const userId = Cookies.get("id");
    const isSignedIn = userId && Cookies.get("hash");

    useEffect(() => {
        if (isSignedIn) {
            fetchJSON("/api/apikey?action=list&id=" + userId)
                .then(data => {
                    if (Array.isArray(data)) {
                        setApiKeys(data);
                    }
                })
                .catch(console.error);
        }
    }, [isSignedIn, userId, counter]);

    const onCreateApiKey = async () => {
        const defaultName = "API Key " + (apiKeys.length + 1);
        const name = window.prompt(translations.ENTER_API_KEY_NAME || "Enter a name for this API Key", defaultName);
        if (!name) return;

        setProgress(true);
        try {
            const data = await fetchJSON("/api/apikey?action=create&id=" + userId, {
                method: "POST",
                body: JSON.stringify({ name })
            });

            if (data.apiKey) {
                window.alert(`${translations.API_KEY_CREATED || "API Key created successfully. Please copy it now as you won't be able to see it again:"}\n\n${data.apiKey}`);
                setCounter(c => c + 1);
            } else if (data.err) {
                throw data.err;
            }
        } catch (err) {
            console.error(err);
            setError(translations[err] || String(err));
        } finally {
            setProgress(false);
        }
    };

    const onDeleteApiKey = async (keyId) => {
        if (!window.confirm(translations.CONFIRM_DELETE_API_KEY || "Are you sure you want to remove this API Key?")) {
            return;
        }
        setProgress(true);
        try {
            await fetchJSON(`/api/apikey?id=${userId}&keyId=${keyId}`, {
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

    if (!isSignedIn) {
        return (
            <div className={styles.root}>
                <div className={styles.card}>
                    <Typography className={styles.title}>{translations.SIGN_IN_REQUIRED || "Sign in required"}</Typography>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <div className={styles.card}>
                {inProgress && <LinearProgress className={styles.progress} />}
                <div className={styles.header}>
                    <Typography component="h1" className={styles.title}>
                        {translations.API_KEYS || "API Keys"}
                    </Typography>
                </div>
                {error && <Typography className={styles.error}>{error}</Typography>}

                <Grid container spacing={2}>
                    <Grid size={12}>
                        <Typography variant="body1" style={{ marginBottom: 16, whiteSpace: "pre-line" }}>
                            {translations.API_KEY_INSTRUCTIONS || "Create an API Key to programmatically access your sessions and library content. To test your key, include it in the Authorization header of your request: `Authorization: Bearer <API_KEY>`."}
                        </Typography>
                    </Grid>

                    <Grid size={12}>
                        <Button
                            onClick={onCreateApiKey}
                            disabled={inProgress}
                            fullWidth
                            variant="outlined"
                            color="primary"
                            className={styles.secondaryButton}
                            startIcon={<VpnKeyIcon />}
                        >
                            {translations.CREATE_API_KEY || "Create API Key"}
                        </Button>
                    </Grid>

                    {apiKeys.length > 0 && <Grid size={12}>
                        <List dense className={styles.passkeyList}>
                            {apiKeys.map(ak => (
                                <ListItem key={ak.id}>
                                    <ListItemText primary={ak.name} secondary={new Date(ak.createdAt).toLocaleDateString()} />
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" aria-label={`${translations.DELETE} ${ak.name}`} onClick={() => onDeleteApiKey(ak.id)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </Grid>}
                </Grid>
            </div>
        </div>
    );
}
