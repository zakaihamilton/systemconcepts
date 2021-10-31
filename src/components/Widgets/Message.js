import Typography from "@material-ui/core/Typography";
import styles from "./Message.module.scss";
import clsx from "clsx";

export default function Message({ animated, Icon, label, show = true }) {
    if (!show) {
        return null;
    }
    return <div className={styles.root}>
        {Icon && <Icon className={clsx(animated && styles.animated)} />}
        {label && <Typography variant="h6">{label}</Typography>}
    </div>;
}
