import React, { useState, useEffect } from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
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
import EmailIcon from '@material-ui/icons/Email';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import { InputAdornment } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(8),
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
        marginTop: theme.spacing(1),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
    rtlLabel: {
        marginRight: "-11px",
        marginLeft: "16px"
    },
    adornment: {
        pointerEvents: "none"
    }
}));

export default function SignIn() {
    const { direction } = MainStore.useState();
    const classes = useStyles();
    const translations = useTranslations();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(true);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [validate, setValidate] = useState(false);

    const changeEmail = event => setEmail(event.target.value);
    const changePassword = event => setPassword(event.target.value);
    const changeRemember = event => setRemember(event.target.value);

    const actionDisabled = emailError || passwordError;

    useEffect(() => {
        if (!validate) {
            setEmailError("");
            setPasswordError("");
            return;
        }
        const emailPattern = /[a-zA-Z0-9]+[\.]?([a-zA-Z0-9]+)?[\@][a-z]{3,9}[\.][a-z]{2,5}/g;
        if (!email) {
            setEmailError(translations.EMPTY_EMAIL);
        }
        else if (!emailPattern.test(email)) {
            setEmailError(translations.BAD_EMAIL);
        }
        else {
            setEmailError("");
        }
        if (!password) {
            setPasswordError(translations.EMPTY_PASSWORD);
        }
        else {
            setPasswordError("");
        }
    }, [password, email, validate]);

    const onSubmit = () => {
        setValidate(true);
    };

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    {translations.SIGN_IN}
                </Typography>
                <form className={classes.form} noValidate>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label={translations.EMAIL_ADDRESS}
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        autoFocus
                        value={email}
                        onChange={changeEmail}
                        error={emailError !== ""}
                        helperText={emailError}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <EmailIcon className={classes.adornment} />
                                </InputAdornment>
                            )
                        }}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label={translations.PASSWORD}
                        type="password"
                        required
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={changePassword}
                        error={passwordError !== ""}
                        helperText={passwordError}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <VpnKeyIcon className={classes.adornment} />
                                </InputAdornment>
                            )
                        }}
                    />
                    <FormControlLabel
                        className={clsx(direction === "rtl" && classes.rtlLabel)}
                        control={<Checkbox value="remember" color="primary" value={remember} onChange={changeRemember} />}
                        label={translations.REMEMBER_ME}
                    />
                    <Button
                        onClick={onSubmit}
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                        disabled={actionDisabled}
                    >
                        {translations.SIGN_IN}
                    </Button>
                    <Grid container>
                        <Grid item xs>
                            <Link href="#" variant="body2">
                                {translations.FORGET_PASSWORD}
                            </Link>
                        </Grid>
                        <Grid item>
                            <Link href="#signup" variant="body2">
                                {translations.SIGN_UP_TEXT}
                            </Link>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </Container>
    );
}