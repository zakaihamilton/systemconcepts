import Typography from "@ui/Typography";
import { useTranslations } from "@util/domain/translations";
import styles from "./AppTitle.module.css";

export default function AppTitle() {
	const { APP_NAME } = useTranslations();
	return (
		<Typography classes={{ root: styles.root }} variant="body1">
			{APP_NAME}
		</Typography>
	);
}
