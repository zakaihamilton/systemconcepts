import Typography from "@ui/Typography";
import clsx from "clsx";
import styles from "./Message.module.css";

export default function Message({ animated, Icon, label, show = true }) {
	if (!show) {
		return null;
	}
	return (
		<div className={styles.root}>
			{Icon && <Icon className={clsx(animated && styles.animated)} />}
			{label && <Typography variant="h6">{label}</Typography>}
		</div>
	);
}
