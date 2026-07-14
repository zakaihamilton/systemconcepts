import { MainStore } from "@components/Main";
import AccountCircleIcon from "@icons/svg/AccountCircle.svg";
import DeleteIcon from "@icons/svg/Delete.svg";
import FingerprintIcon from "@icons/svg/Fingerprint.svg";
import VpnKeyIcon from "@icons/svg/VpnKey.svg";
import {
	browserSupportsWebAuthn,
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";
import { clearBundleCache } from "@sync/sync";
import { loadUserSyncState, UpdateSessionsStore } from "@sync/syncState";
import Button from "@ui/Button";
import Checkbox from "@ui/Checkbox";
import FormControlLabel from "@ui/FormControlLabel";
import Grid from "@ui/Grid";
import IconButton from "@ui/IconButton";
import LinearProgress from "@ui/LinearProgress";
import Link from "@ui/Link";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import ListItemSecondaryAction from "@ui/ListItemSecondaryAction";
import ListItemText from "@ui/ListItemText";
import Typography from "@ui/Typography";
import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import storage from "@util/storage/storage";
import Input from "@widgets/Input";
import clsx from "clsx";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import styles from "./Account.module.css";

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

	const changeRemember = (event) => setRemember(event.target.value);
	const changeCreatePasskey = (event) => setCreatePasskey(event.target.checked);

	useEffect(() => {
		if (isSignedIn) {
			fetchJSON("/api/passkey?action=list&id=" + userId)
				.then((data) => {
					if (Array.isArray(data)) {
						setPasskeys(data);
					}
				})
				.catch(structuredLogger.error);
		}
	}, [isSignedIn, userId, counter]); // Reload when counter changes (e.g. login/logout/register)

	const onRegisterPasskey = async (targetId) => {
		const idToRegister = targetId || userId;
		setProgress(true);
		try {
			const options = await fetchJSON(
				"/api/passkey?action=register-options&id=" + idToRegister,
			);

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
				name = window.prompt(
					translations.ENTER_PASSKEY_NAME || "Enter a name for this passkey",
					defaultName,
				);
			}

			const verification = await fetchJSON(
				"/api/passkey?action=register-verify&id=" + idToRegister,
				{
					method: "POST",
					body: JSON.stringify({ ...attResp, name }),
				},
			);

			if (verification.verified) {
				setError("PASSKEY_REGISTERED");
				setCounter((c) => c + 1); // Refresh list
			} else {
				throw "PASSKEY_REGISTRATION_FAILED";
			}
		} catch (err) {
			structuredLogger.error(err);
			setError(translations[err] || String(err));
		} finally {
			setProgress(false);
		}
	};

	const onDeletePasskey = async (credentialId) => {
		if (
			!window.confirm(
				translations.CONFIRM_DELETE_PASSKEY ||
					"Are you sure you want to remove this passkey?",
			)
		) {
			return;
		}
		setProgress(true);
		try {
			await fetchJSON(
				`/api/passkey?id=${userId}&credentialId=${credentialId}`,
				{
					method: "DELETE",
				},
			);
			setCounter((c) => c + 1);
		} catch (err) {
			structuredLogger.error(err);
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
			const options = await fetchJSON(
				"/api/passkey?action=auth-options&id=" + id,
			);

			if (options.err) {
				throw options.err;
			}

			const asseResp = await startAuthentication({ optionsJSON: options });

			const verification = await fetchJSON(
				"/api/passkey?action=auth-verify&id=" + id,
				{
					method: "POST",
					body: JSON.stringify(asseResp),
				},
			);

			if (!verification.err) {
				if (verification.role) {
					Cookies.set("role", verification.role, remember && { expires: 60 });
				}
				loadUserSyncState(id);
				if (redirect) {
					setHash(decodeURIComponent(redirect));
				} else {
					setPath("");
				}
			} else {
				throw "PASSKEY_LOGIN_FAILED";
			}
		} catch (err) {
			structuredLogger.error(err);
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
			await fetchJSON("/api/login", { method: "DELETE" }).catch(
				structuredLogger.error,
			);
			// Clear cookies
			Cookies.set("id", "");
			Cookies.set("hash", "");
			Cookies.set("role", "");
			idState[1]("");

			// Clear bundle cache on logout
			await clearBundleCache({ userId });
			await storage.deleteFolder("local");

			UpdateSessionsStore.update((s) => {
				s.busy = false; // Reset busy state to allow re-fetching
				s.status = [];
			});
			setCounter((counter) => counter + 1);
		} else {
			setValidate(true);
			if (!invalidFields && !inProgress) {
				let [id] = idState;
				const [password] = passwordState;
				id = id.toLowerCase();
				setProgress(true);
				fetchJSON("/api/login", {
					headers: {
						id,
						password: encodeURIComponent(password),
					},
				})
					.then(async (data) => {
						const { err } = data;
						if (err) {
							structuredLogger.error(err);
							throw err;
						}
						Cookies.set(
							"role",
							data.role || "visitor",
							remember && { expires: 60 },
						);
						loadUserSyncState(id);

						if (createPasskey) {
							try {
								await onRegisterPasskey(id);
							} catch (e) {
								structuredLogger.error(
									"Failed to create passkey after login",
									e,
								);
							}
						}

						setProgress(false);
						setError("");
						if (redirect) {
							setHash(decodeURIComponent(redirect));
						} else {
							setPath("");
						}
					})
					.catch((err) => {
						Cookies.set("id", "");
						Cookies.set("hash", "");
						Cookies.set("role", "");
						setError(translations[err] || String(err));
						setProgress(false);
					});
			}
		}
	};

	const onValidateField = (text) => {
		let error = "";
		if (!text) {
			error = translations.EMPTY_FIELD;
		}
		return error;
	};

	const onValidatePassword = (text) => {
		let error = "";
		if (!text) {
			error = translations.EMPTY_PASSWORD;
		}
		return error;
	};

	const invalidFields =
		onValidateField(idState[0]) || onValidatePassword(passwordState[0]);
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
				{error && <Typography className={styles.error}>{error}</Typography>}
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
						{!isSignedIn && (
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
						)}
						{!isSignedIn && (
							<Grid size={12}>
								<FormControlLabel
									className={clsx(
										styles.checkboxLabel,
										direction === "rtl" && styles.rtlLabel,
									)}
									control={
										<Checkbox
											color="primary"
											value={remember}
											onChange={changeRemember}
										/>
									}
									label={translations.REMEMBER_ME}
								/>
							</Grid>
						)}
						{!isSignedIn && browserSupportsWebAuthn() && (
							<Grid size={12}>
								<FormControlLabel
									className={clsx(
										styles.checkboxLabel,
										direction === "rtl" && styles.rtlLabel,
									)}
									control={
										<Checkbox
											color="primary"
											checked={createPasskey}
											onChange={changeCreatePasskey}
										/>
									}
									label={
										translations.CREATE_PASSKEY ||
										"Create Passkey for this device"
									}
								/>
							</Grid>
						)}
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
						{!isSignedIn && (
							<Grid size={12}>
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
							</Grid>
						)}
						{isSignedIn && (
							<Grid size={12}>
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
							</Grid>
						)}
						{isSignedIn && passkeys.length > 0 && (
							<Grid size={12}>
								<Typography className={styles.passkeyTitle}>
									{translations.PASSKEYS}
								</Typography>
								<List dense className={styles.passkeyList}>
									{passkeys.map((pk) => (
										<ListItem key={pk.id}>
											<ListItemText
												primary={pk.name}
												secondary={new Date(pk.createdAt).toLocaleDateString()}
											/>
											<ListItemSecondaryAction>
												<IconButton
													edge="end"
													aria-label={`${translations.DELETE} ${pk.name}`}
													onClick={() => onDeletePasskey(pk.id)}
												>
													<DeleteIcon />
												</IconButton>
											</ListItemSecondaryAction>
										</ListItem>
									))}
								</List>
							</Grid>
						)}
						<Grid size={12}>
							<div className={styles.links}>
								{!isSignedIn && (
									<>
										<Link href="#resetpassword">
											{translations.FORGET_PASSWORD}
										</Link>
										<Link href="#signup">{translations.SIGN_UP_TEXT}</Link>
									</>
								)}
								{isSignedIn && (
									<>
										<Link href="#changepassword">
											{translations.CHANGE_PASSWORD}
										</Link>
										<Link
											href={"#account/" + encodeURIComponent(`user/${userId}`)}
										>
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
