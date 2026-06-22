import { MainStore } from "@components/Main";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { fetchJSON } from "@util/api/fetch";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath } from "@util/domain/views";
import Input from "@widgets/Input";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import Cookies from "js-cookie";
import { useState } from "react";
import styles from "../../Account/Account/Account.module.css";

export default function ChangePassword() {
	const { direction } = MainStore.useState();

	const translations = useTranslations();
	const idState = useState(Cookies.get("id") || "");
	const oldPasswordState = useState("");
	const newPasswordState = useState("");
	const [remember, setRemember] = useState(true);
	const [validate, setValidate] = useState(false);
	const [inProgress, setProgress] = useState(false);
	const [error, setError] = useState(false);

	const changeRemember = (event) => setRemember(event.target.value);

	const onValidatePassword = (text) => {
		let error = "";
		if (!text) {
			error = translations.EMPTY_PASSWORD;
		} else if (text.length < 8) {
			error = translations.PASSWORD_TOO_SHORT;
		} else if (text.length > 72) {
			error = translations.PASSWORD_TOO_LONG;
		}
		return error;
	};

	const onValidateField = (text) => {
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
					newpassword: encodeURIComponent(newPassword),
				},
			})
				.then(({ err }) => {
					if (err) {
						console.error(err);
						throw err;
					}
					setProgress(false);
					setError("");
					setPath("");
				})
				.catch((err) => {
					setError(translations[err] || String(err));
					setProgress(false);
				});
		}
	};

	const onKeyDown = async (event) => {
		if (event.keyCode == 13) {
			onSubmit();
		}
	};

	const goBack = () => {
		setHash("account");
	};

	return (
		<div className={styles.root}>
			<div className={styles.card}>
				{inProgress && <LinearProgress className={styles.progress} />}
				<div className={styles.header}>
					<Tooltip title={translations.BACK} arrow>
						<IconButton
							className={clsx(
								styles.backButton,
								direction === "rtl" && styles.rtl,
							)}
							onClick={goBack}
						>
							<ArrowBackIcon />
						</IconButton>
					</Tooltip>
					<Typography component="h1" className={styles.title}>
						{translations.CHANGE_PASSWORD}
					</Typography>
				</div>
				{error && <Typography className={styles.error}>{error}</Typography>}
				<div className={styles.form}>
					<Grid container spacing={2}>
						<Grid size={12}>
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
								background={true}
							/>
						</Grid>
						<Grid size={12}>
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
								background={true}
							/>
						</Grid>
						<Grid size={12}>
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
						</Grid>
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
						<Grid size={12}>
							<Button
								fullWidth
								variant="contained"
								color="primary"
								className={styles.submit}
								disabled={!!(isInvalid || inProgress)}
								onClick={onSubmit}
							>
								{translations.CHANGE_PASSWORD}
							</Button>
						</Grid>
					</Grid>
				</div>
			</div>
		</div>
	);
}
