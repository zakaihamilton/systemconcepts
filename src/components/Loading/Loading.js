import LinearProgress from "@mui/material/LinearProgress";
import { logger as structuredLogger } from "@util/api/logger";
import styles from "./Loading.module.css";

export default function Loading({ error }) {
	if (error) {
		structuredLogger.error(error);
	}
	return (
		<div className={styles.root}>
			<div className={styles.progress}>
				<LinearProgress />
			</div>
		</div>
	);
}
