import { createPortal } from "react-dom";
import styles from "../shared.module.css";

export default function Snackbar({
	open,
	message,
	onClose,
	autoHideDuration = 4000,
}) {
	if (!open) return null;

	if (autoHideDuration && onClose) {
		setTimeout(onClose, autoHideDuration);
	}

	return createPortal(
		<div className={styles.snackbar} role="status">
			{message}
		</div>,
		document.body,
	);
}
