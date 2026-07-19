import Fade from "@ui/Fade";
import clsx from "clsx";
import React from "react";
import styles from "./PageIndicator.module.css";

const PageIndicator = React.memo(
	({ current, total, visible, translations, label, onClick }) => {
		const text = `${label || translations.PAGE} ${current} / ${total}`;
		const content = onClick ? (
			<button
				type="button"
				className={clsx(styles.text, styles.button)}
				onClick={onClick}
				aria-haspopup="menu"
				aria-label={text}
			>
				{text}
			</button>
		) : (
			<div className={styles.text}>{text}</div>
		);

		return (
			<Fade in={visible} timeout={1000}>
				<div
					className={clsx(
						"print-hidden",
						styles.root,
						onClick && styles.clickable,
					)}
				>
					{content}
				</div>
			</Fade>
		);
	},
);
PageIndicator.displayName = "PageIndicator";

export default PageIndicator;
