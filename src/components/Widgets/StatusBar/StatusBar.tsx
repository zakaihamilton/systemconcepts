import { SyncContext } from "@components/Sync";
import ButtonSelector from "@components/Widgets/ButtonSelector";
import CancelIcon from "@icons/svg/Cancel.svg";
import CheckBoxIcon from "@icons/svg/CheckBox.svg";
import CheckBoxOutlineBlankIcon from "@icons/svg/CheckBoxOutlineBlank.svg";
import ContentCopyIcon from "@icons/svg/ContentCopy.svg";
import DeleteIcon from "@icons/svg/Delete.svg";
import IndeterminateCheckBoxIcon from "@icons/svg/IndeterminateCheckBox.svg";
import Button from "@ui/Button";
import IconButton from "@ui/IconButton";
import Typography from "@ui/Typography";
import { createStore } from "@util/browser/store";
import { useTranslations } from "@util/domain/translations";
import { setPath } from "@util/domain/views";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { useContext, useEffect, useState } from "react";
import styles from "./StatusBar.module.css";
export const StatusBarStore = createStore({ active: 0 });

export default function StatusBar({ data, mapper, store }: any) {
	const syncContext = useContext(SyncContext);
	const translations = useTranslations();
	const { mode, select, message, onDone, severity = "info" } = store.useState();
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	const open = !!(select || message);

	useEffect(() => {
		if (open) {
			StatusBarStore.update((s) => {
				s.active++;
			});
		}
		return () => {
			if (open) {
				StatusBarStore.update((s) => {
					s.active--;
				});
			}
		};
	}, [open]);

	if (!open) {
		return null;
	}

	const count = select && select.length;
	const disabled = busy || !count;

	const onClick = async () => {
		let result = false;
		if (onDone) {
			setBusy(true);
			try {
				result = await onDone(select);
			} catch (err: any) {
				store.update((s: any) => {
					s.message = err;
					s.severity = "error";
				});
			} finally {
				setBusy(false);
			}
		}
		if (!result) {
			store.update((s: any) => {
				s.counter++;
				s.select = null;
				s.mode = null;
			});
		}
	};

	const handleClose = (_event?: any, reason?: any) => {
		if (reason === "clickaway" || busy) {
			return;
		}

		store.update((s: any) => {
			s.select = null;
			s.message = null;
			s.mode = null;
		});
	};

	let messageText = message && message.toString();
	if (mode === "sync" && syncContext.error) {
		messageText = translations.WAIT_FOR_APPROVAL;
	}
	const canCopyError = mode === "player" && severity === "error" && messageText;
	const copyError = async () => {
		try {
			await navigator.clipboard?.writeText(messageText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Keep the original message visible when clipboard access is unavailable.
		}
	};

	const selectTitle =
		select && select.length
			? translations.SELECT_NONE
			: translations.SELECT_ALL;
	let selectIcon = null;
	if (select && data) {
		if (!select.length) {
			selectIcon = <CheckBoxOutlineBlankIcon />;
		} else if (select.length === data.length) {
			selectIcon = <CheckBoxIcon />;
		} else {
			selectIcon = <IndeterminateCheckBoxIcon />;
		}
	}

	const selectClick = () => {
		store.update((s: any) => {
			if (select.length) {
				s.select.length = 0;
			} else {
				const items = mapper ? data.map(mapper) : data;
				s.select = [...items];
			}
		});
	};

	const modeItems = (mode === "move" || mode === "copy") && [
		{
			id: "move",
			name: translations.MOVE,
		},
		{
			id: "copy",
			name: translations.COPY,
		},
	];

	const setMode = (mode: any) => {
		store.update((s: any) => {
			s.mode = mode;
		});
	};

	const gotoAccount = () => {
		const hash = window.location.hash;
		const currentPath = hash.startsWith("#") ? hash.substring(1) : hash;
		setPath("account?redirect=" + encodeURIComponent(currentPath));
	};

	return (
		<div className={clsx(styles.root, styles[severity])}>
			{selectTitle && selectIcon && (
				<Tooltip title={selectTitle} arrow>
					<IconButton
						aria-label={selectTitle}
						onClick={selectClick}
						size="large"
					>
						{selectIcon}
					</IconButton>
				</Tooltip>
			)}
			{mode === "delete" && !busy && (
				<Tooltip title={translations[mode.toUpperCase()]} arrow>
					<IconButton
						aria-label={translations[mode.toUpperCase()]}
						onClick={onClick}
						size="large"
					>
						<DeleteIcon />
					</IconButton>
				</Tooltip>
			)}
			{mode && (mode === "copy" || mode === "move") && (
				<ButtonSelector
					items={modeItems}
					state={[mode, setMode]}
					disabled={disabled}
					onClick={onClick}
				>
					{translations[mode.toUpperCase()]}
					{modeItems && "\u2026"}
				</ButtonSelector>
			)}
			<Typography className={styles.message}>{messageText}</Typography>
			<div style={{ flex: 1 }} />
			{canCopyError && (
				<Tooltip
					title={
						copied
							? translations.COPIED || "Copied!"
							: translations.COPY || "Copy"
					}
					arrow
				>
					<IconButton
						aria-label={
							copied
								? translations.COPIED || "Copied!"
								: translations.COPY || "Copy"
						}
						onClick={copyError}
						size="large"
					>
						<ContentCopyIcon />
					</IconButton>
				</Tooltip>
			)}
			{mode && mode === "signin" && (
				<Button variant="contained" onClick={gotoAccount}>
					{translations.ACCOUNT}
				</Button>
			)}
			{!busy && (
				<Tooltip title={translations.CLOSE} arrow>
					<IconButton
						aria-label={translations.CLOSE}
						onClick={handleClose}
						size="large"
					>
						<CancelIcon />
					</IconButton>
				</Tooltip>
			)}
		</div>
	);
}
