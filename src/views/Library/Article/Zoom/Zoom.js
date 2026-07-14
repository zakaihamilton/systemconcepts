import ContentCopyIcon from "@icons/ContentCopy";
import Box from "@ui/Box";
import Dialog from "@ui/Dialog";
import DialogContent from "@ui/DialogContent";
import IconButton from "@ui/IconButton";
import Typography from "@ui/Typography";
import { useSwipe } from "@util/browser/touch";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import { useCallback, useEffect, useRef } from "react";
import styles from "./Zoom.module.css";
export default function Zoom({
	open,
	onClose,
	content,
	number,
	badgeClass,
	Renderer,
	copyExcludeSelectors,
	onNavigate,
}) {
	const contentRef = useRef(null);
	const translations = useTranslations();

	const handleCopy = () => {
		let text = "";
		if (contentRef.current) {
			if (copyExcludeSelectors && copyExcludeSelectors.length) {
				const clone = contentRef.current.cloneNode(true);
				copyExcludeSelectors.forEach((selector) => {
					const elements = clone.querySelectorAll(selector);
					elements.forEach((element) => element.remove());
				});
				text = clone.innerText;
			} else {
				text = contentRef.current.innerText;
			}
		}
		if (text) {
			navigator.clipboard.writeText(text.replace(/\r?\n|\r/g, " "));
		}
	};

	const handlePrevious = useCallback(() => {
		if (onNavigate) {
			onNavigate(number - 1);
		}
	}, [onNavigate, number]);

	const handleNext = useCallback(() => {
		if (onNavigate) {
			onNavigate(number + 1);
		}
	}, [onNavigate, number]);

	const swipeHandlers = useSwipe({
		onSwipeDown: handlePrevious,
		onSwipeUp: handleNext,
	});

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!open) return;
			if (e.key === "ArrowUp") {
				e.preventDefault();
				handlePrevious();
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				handleNext();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, handlePrevious, handleNext]);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogContent className={styles.root} {...swipeHandlers}>
				<Tooltip title={translations.COPY} arrow>
					<IconButton
						className={styles.copyButton}
						onClick={handleCopy}
						size="small"
					>
						<ContentCopyIcon fontSize="small" />
					</IconButton>
				</Tooltip>
				<Box className={styles.itemWrapper}>
					{number && (
						<span className={`${badgeClass} ${styles.badge}`}>{number}</span>
					)}
					<Typography
						ref={contentRef}
						variant="h5"
						component="div"
						className={styles.item}
					>
						{Renderer && <Renderer>{content}</Renderer>}
					</Typography>
				</Box>
			</DialogContent>
		</Dialog>
	);
}
