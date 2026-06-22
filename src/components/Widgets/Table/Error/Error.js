import ErrorIcon from "@mui/icons-material/Error";
import { useTranslations } from "@util/domain/translations";
import Label from "@widgets/Label";
import Tooltip from "@widgets/Tooltip";
import styles from "./Error.module.css";

export default function Error({ error }) {
	const translations = useTranslations();
	const message = error?.message || error;
	const text = translations[message] || message;
	return (
		<Label
			className={styles.root}
			icon={
				<Tooltip title={translations.ERROR} arrow>
					<span>
						<ErrorIcon />
					</span>
				</Tooltip>
			}
			name={text}
		/>
	);
}
