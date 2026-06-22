import CancelIcon from "@mui/icons-material/Cancel";
import { IconButton } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import styles from "./Dialog.module.css";

export default function Dialog({
	title,
	children,
	actions,
	onClose,
	className,
	...props
}) {
	const translations = useTranslations();

	return (
		<div className={styles.root} onClick={onClose} {...props}>
			<div className={styles.background} onClick={(e) => e.stopPropagation()}>
				<div className={clsx(styles.dialog, className)}>
					<div className={styles.title}>
						<Typography variant="h6">{title}</Typography>
						<div style={{ flex: 1 }} />
						<Tooltip title={translations.CLOSE} arrow>
							<IconButton
								aria-label={translations.CLOSE}
								className={styles.closeDialog}
								onClick={onClose}
								size="large"
							>
								<CancelIcon />
							</IconButton>
						</Tooltip>
					</div>
					<div className={styles.content}>{children}</div>
					{!!actions && <div className={styles.actions}>{actions}</div>}
				</div>
			</div>
		</div>
	);
}
