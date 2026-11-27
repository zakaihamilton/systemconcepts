import { MainStore } from "@components/Main";
import AccountCircleIcon from "@icons/svg/AccountCircle.svg";
import VpnKeyIcon from "@icons/svg/VpnKey.svg";
import { clearBundleCache } from "@sync/sync";
import { loadUserSyncState, UpdateSessionsStore } from "@sync/syncState";
import Button from "@ui/Button";
import Checkbox from "@ui/Checkbox";
import FormControlLabel from "@ui/FormControlLabel";
import Grid from "@ui/Grid";
import LinearProgress from "@ui/LinearProgress";
import Link from "@ui/Link";
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

export default function Account({ redirect }: any) {
	const { direction } = MainStore.useState();

	const translations = useTranslations();
	const perministerEnabled =
		process.env.NEXT_PUBLIC_PERMINISTER_LOGIN_ENABLED === "true";
	const idState = useState(Cookies.get("id") || "");
	const passwordState = useState("");
	const [remember, setRemember] = useState(true);
	const [validate, setValidate] = useState(false);
	const [error, setError] = useState("");
	const [inProgress, setProgress] = useState(false);

	const userId = Cookies.get("id");
	const isSignedIn = userId && Cookies.get("hash");

	const changeRemember = (event: any) => setRemember(event.target.checked);

	useEffect(() => {
		if (window.location.hash.includes("auth=perminister-error")) {
			setError(
				translations.PERMINISTER_SIGN_IN_FAILED ||
					"Perminister sign-in failed. Please try again.",
			);
		}
	}, [translations]);

	const onSubmit = async (event: any) => {
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
		} else {
			if (perministerEnabled) {
				const returnTo = redirect
					? `/#/${decodeURIComponent(redirect)}`
					: "/#/";
				const params = new URLSearchParams({ next: returnTo });
				if (window.location.hash.includes("auth=perminister-error")) {
					params.set("force_login", "true");
				}
				window.location.assign(
					`/auth/perminister/start?${params}`,
				);
				return;
			}
			setValidate(true);
			if (!invalidFields && !inProgress) {
				let [id] = idState;
				const [password] = passwordState;
				id = id.toLowerCase();
				setProgress(true);
				fetchJSON("/api/login", {
					method: "POST",
					body: JSON.stringify({ action: "login", id, password, remember }),
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
							remember ? { expires: 60 } : undefined,
						);
						loadUserSyncState(id);
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
						setError(translations[String(err)] || String(err));
						setProgress(false);
					});
			}
		}
	};

	const onValidateField = (text: any) => {
		let error = "";
		if (!text) {
			error = translations.EMPTY_FIELD;
		}
		return error;
	};

	const onValidatePassword = (text: any) => {
		let error = "";
		if (!text) {
			error = translations.EMPTY_PASSWORD;
		}
		return error;
	};

	const invalidFields =
		onValidateField(idState[0]) || onValidatePassword(passwordState[0]);
	const isInvalid = !perministerEnabled && validate && invalidFields;
	const submitLabel = isSignedIn
		? translations.SIGN_OUT
		: perministerEnabled
			? translations.CONTINUE_TO_PERMINISTER || "Continue to Perminister"
			: translations.SIGN_IN;

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
						{!perministerEnabled && (
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
						)}
						{!isSignedIn && !perministerEnabled && (
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
						{!isSignedIn && !perministerEnabled && (
							<Grid size={12}>
								<FormControlLabel
									className={clsx(
										styles.checkboxLabel,
										direction === "rtl" && styles.rtlLabel,
									)}
									control={
										<Checkbox
											color="primary"
											checked={remember}
											onChange={changeRemember}
										/>
									}
									label={translations.REMEMBER_ME}
								/>
							</Grid>
						)}
						<Grid size={12}>
							<Button
								type="submit"
								disabled={!!isInvalid || inProgress}
								fullWidth
								variant="contained"
								color="primary"
								className={styles.submit}
							>
								{submitLabel}
							</Button>
						</Grid>
						<Grid size={12}>
							<div className={styles.links}>
								{!isSignedIn && !perministerEnabled && (
									<>
										<Link href="#resetpassword">
											{translations.FORGET_PASSWORD}
										</Link>
										<Link href="#signup">{translations.SIGN_UP_TEXT}</Link>
									</>
								)}
								{isSignedIn && (
									<>
										{!perministerEnabled && (
											<Link href="#changepassword">
												{translations.CHANGE_PASSWORD}
											</Link>
										)}
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
