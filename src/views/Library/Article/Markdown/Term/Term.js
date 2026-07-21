import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { getStyleInfo, PHASE_COLORS } from "../../GlossaryUtils";
import styles from "./Term.module.css";

const Term = ({ term, entry, search }) => {
	const translations = useTranslations();
	const [hover, setHover] = useState(false);
	const [tooltipStyle, setTooltipStyle] = useState({});
	const [bridgeStyle, setBridgeStyle] = useState({});
	const [placement, setPlacement] = useState("top");
	const containerRef = useRef(null);
	const tooltipRef = useRef(null);
	const hoverTimeoutRef = useRef(null);
	const [isMeasured, setIsMeasured] = useState(false);

	const styleInfo = getStyleInfo(entry.style);
	const phaseRaw = styleInfo?.phase;
	const phaseKey = typeof phaseRaw === "string" ? phaseRaw.toLowerCase() : null;
	const phaseColor = phaseKey ? PHASE_COLORS[phaseKey] : null;
	const phaseLabel = phaseKey
		? phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1)
		: null;

	const handleMouseEnter = () => {
		hoverTimeoutRef.current = setTimeout(() => {
			setPlacement("top");
			setHover(true);
			setIsMeasured(false); // Reset measurement state
		}, 300); // 300ms delay
	};

	const handleMouseLeave = () => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current);
			hoverTimeoutRef.current = null;
		}
		setHover(false);
		setIsMeasured(false);
	};

	useEffect(() => {
		const handleScroll = () => {
			if (hover) {
				setHover(false);
				setIsMeasured(false);
				if (hoverTimeoutRef.current) {
					clearTimeout(hoverTimeoutRef.current);
				}
			}
		};
		// Use capture: true to detect scroll events on parent containers
		window.addEventListener("scroll", handleScroll, {
			passive: true,
			capture: true,
		});
		return () =>
			window.removeEventListener("scroll", handleScroll, { capture: true });
	}, [hover]);

	// Layout effect to measure and position tooltip once it renders
	React.useLayoutEffect(() => {
		if (hover && tooltipRef.current && containerRef.current && !isMeasured) {
			const rect = containerRef.current.getBoundingClientRect();

			// Use offsetHeight to avoid transform scaling issues (animation)
			const tooltipHeight = tooltipRef.current.offsetHeight;
			const spaceTop = rect.top;

			const scrollX = window.scrollX;
			const scrollY = window.scrollY;

			// Base style for Portal (absolute relative to document)
			const baseStyle = {
				position: "absolute",
				left: `${rect.left + scrollX + rect.width / 2}px`,
				zIndex: 1300,
				margin: 0,
				opacity: 0, // Keep invisible until positioned
			};

			const bridgeBase = {
				position: "absolute",
				left: `${rect.left + scrollX}px`,
				width: `${rect.width}px`,
				transform: "none",
				zIndex: 1299,
			};

			let newTooltipStyle = {};
			let newBridgeStyle = {};

			// Logic: Prefer TOP if space permits, otherwise check BOTTOM
			// Or stick to original logic: if (spaceTop < 250) -> BOTTOM
			// New Logic: Check actual height against available space

			// Padding/Margin buffer
			const buffer = 20;

			// If there is not enough space on top for actual height, go bottom
			if (spaceTop < tooltipHeight + buffer) {
				// Place BOTTOM
				const topVal = rect.bottom + scrollY + 10;
				newTooltipStyle = {
					...baseStyle,
					top: `${topVal}px`,
					bottom: "auto",
					transform: "translateX(-50%)", // Base transform for bottom
					opacity: 1, // Make visible
				};
				newBridgeStyle = {
					...bridgeBase,
					top: `${rect.bottom + scrollY}px`,
					height: "10px",
				};
				setPlacement("bottom");
			} else {
				// Place TOP (Default preference)
				const topVal = rect.top + scrollY - 10;
				newTooltipStyle = {
					...baseStyle,
					top: `${topVal}px`,
					bottom: "auto",
					transform: "translate(-50%, -100%)", // Base transform for top
					opacity: 1, // Make visible
				};
				newBridgeStyle = {
					...bridgeBase,
					top: `${rect.top + scrollY - 10}px`,
					height: "10px",
				};
				setPlacement("top");
			}

			setTooltipStyle(newTooltipStyle);
			setBridgeStyle(newBridgeStyle);
			setIsMeasured(true);
		}
	}, [hover, isMeasured]);

	const mainText = entry.en || entry.trans || term;
	const showAnnotation =
		entry.trans && entry.trans.toLowerCase() !== mainText.toLowerCase();

	// Check for search match
	let isMatch = false;
	if (search) {
		const terms = Array.isArray(search) ? search : [search];
		isMatch = terms.some((termStr) => {
			if (!termStr) return false;
			const lowerSearch = termStr.toLowerCase();
			return (
				term.toLowerCase().includes(lowerSearch) ||
				(entry.en && entry.en.toLowerCase().includes(lowerSearch)) ||
				(entry.trans && entry.trans.toLowerCase().includes(lowerSearch)) ||
				(entry.he && entry.he.includes(termStr))
			);
		});
	}

	// Combine classes: locally scoped style + global 'search-highlight' for Article.js to find
	const mainTextClass = `${styles["glossary-main-text"]} ${isMatch ? "search-highlight" : ""}`;

	return (
		<span
			className={styles["glossary-term-container"]}
			ref={containerRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* The Transliteration (Top Annotation) */}
			{showAnnotation && (
				<span className={styles["glossary-annotation"]}>{entry.trans}</span>
			)}

			{/* The Main Text (English Translation) */}
			<span
				className={mainTextClass}
				style={phaseColor ? { borderBottom: `2px solid ${phaseColor}` } : {}}
			>
				{mainText}
			</span>

			{/* The Tooltip (Portalled) */}
			{hover &&
				ReactDOM.createPortal(
					<>
						{/* Bridge ensures connection between word and tooltip */}
						{isMeasured && (
							<div className={styles["glossary-bridge"]} style={bridgeStyle} />
						)}

						<div
							className={clsx(styles["glossary-tooltip"], styles[placement])}
							style={
								isMeasured
									? tooltipStyle
									: { opacity: 0, position: "fixed", top: -9999, left: -9999 }
							}
							ref={tooltipRef}
						>
							{styleInfo?.category && (
								<div
									className={styles["tt-category"]}
									style={{
										display: "inline-block",
										background: "#eee",
										padding: "2px 6px",
										borderRadius: "4px",
										fontSize: "0.7rem",
										marginBottom: "8px",
										color: "#333",
									}}
								>
									{styleInfo.category}
								</div>
							)}
							{phaseLabel && (
								<div
									className={styles["tt-phase"]}
									style={{
										display: "inline-block",
										background: phaseColor,
										color: "#000",
										padding: "2px 6px",
										borderRadius: "4px",
										fontSize: "0.7rem",
										marginBottom: "8px",
										marginLeft: "6px",
										border: "1px solid rgba(0,0,0,0.1)",
									}}
								>
									{phaseLabel}
								</div>
							)}
							{/* English Section */}
							<div className={styles["tt-label"]}>
								{translations.TRANSLATION}
							</div>
							<div className={styles["tt-value"]}>{entry.en || mainText}</div>

							<hr />

							{/* Transliteration Section */}
							<div className={styles["tt-label"]}>
								{translations.TRANSLITERATION}
							</div>
							<div className={styles["tt-value"]}>{entry.trans}</div>

							{!!entry.he && (
								<>
									<hr />
									<div className={styles["tt-label"]}>
										{translations.HEBREW}
									</div>
									<div className={styles["tt-hebrew"]}>{entry.he}</div>
								</>
							)}
						</div>
					</>,
					document.body,
				)}
		</span>
	);
};

Term.displayName = "Term";

export default Term;
