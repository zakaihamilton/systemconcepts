import Menu from "@ui/Menu";
import MenuItem from "@ui/MenuItem";
import clsx from "clsx";
import { useEffect } from "react";
import styles from "./ResultsOutline.module.css";

export default function ResultsOutline({
	open,
	anchorEl,
	onClose,
	results = [],
	currentIndex = 0,
	onSelect,
	translations = {},
}) {
	useEffect(() => {
		if (!open) return;
		const selected = document.querySelector(
			`[data-result-outline-index="${currentIndex}"]`,
		);
		if (typeof selected?.scrollIntoView === "function") {
			selected.scrollIntoView({ block: "nearest" });
		}
	}, [open, currentIndex]);

	return (
		<Menu
			open={open}
			anchorEl={anchorEl}
			onClose={onClose}
			anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
			transformOrigin={{ vertical: "top", horizontal: "right" }}
			style={{
				minWidth: 280,
				maxWidth: "min(420px, calc(100vw - 24px))",
				zIndex: 1500,
			}}
			aria-label={translations.RESULTS_LIST || "Results list"}
		>
			{results.map((doc, index) => {
				const title = doc.tag?.title || doc.name || "";
				const kind = doc.isSession
					? translations.SESSIONS || "Session"
					: translations.ARTICLES || "Article";
				const matchCount = doc.matches?.length || 0;
				const matchLabel = translations.MATCH || "matches";
				return (
					<MenuItem
						key={doc.docId || index}
						selected={index === currentIndex}
						className={clsx(styles.item)}
						data-result-outline-index={index}
						onClick={() => onSelect?.(index)}
					>
						<span className={styles.index}>{index + 1}</span>
						<span className={styles.body}>
							<span className={styles.title}>{title}</span>
							<span className={styles.meta}>
								{kind}
								{" · "}
								{matchCount} {matchLabel}
							</span>
						</span>
					</MenuItem>
				);
			})}
		</Menu>
	);
}
