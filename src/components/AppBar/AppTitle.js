
import Typography from "@mui/material/Typography";
import styles from "./AppTitle.module.css";
import { useTranslations } from "@util/translations";

export default function AppTitle() {
    const { APP_NAME } = useTranslations();
    return <Typography classes={{ root: styles.root }} variant="body1">
        {APP_NAME}
    </Typography>;
}
