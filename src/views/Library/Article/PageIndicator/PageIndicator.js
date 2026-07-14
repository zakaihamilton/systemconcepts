import Fade from "@ui/Fade";
import Paper from "@ui/Paper";
import Typography from "@ui/Typography";
import styles from "./PageIndicator.module.css";

export default function PageIndicator({ scrollInfo }) {
	return (
		<Fade in={scrollInfo.visible} timeout={1000}>
			<Paper elevation={4} className={`print-hidden ${styles.indicator}`}>
				<Typography variant="body2" className={styles.label}>
					Page {scrollInfo.page} / {scrollInfo.total}
				</Typography>
			</Paper>
		</Fade>
	);
}
