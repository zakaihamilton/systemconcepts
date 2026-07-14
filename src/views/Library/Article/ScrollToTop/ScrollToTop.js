import ArrowUpwardIcon from "@icons/ArrowUpward";
import Box from "@ui/Box";
import Fab from "@ui/Fab";
import Zoom from "@ui/Zoom";
import Tooltip from "@widgets/Tooltip";
import styles from "./ScrollToTop.module.css";

export default function ScrollToTop({ show, translations, onClick }) {
	return (
		<Zoom in={show}>
			<Box className={styles.container}>
				<Tooltip title={translations.SCROLL_TO_TOP} placement="right">
					<Fab
						size="small"
						aria-label="scroll back to top"
						onClick={onClick}
						className={styles.fab}
					>
						<ArrowUpwardIcon fontSize="small" />
					</Fab>
				</Tooltip>
			</Box>
		</Zoom>
	);
}
