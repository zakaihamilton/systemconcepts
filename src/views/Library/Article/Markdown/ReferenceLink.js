import ArrowForwardIcon from "@icons/svg/ArrowForward.svg";
import { useTranslations } from "@util/domain/translations";
import { setPath } from "@util/domain/views";
import Tooltip from "@widgets/Tooltip";
import React, { useCallback } from "react";

import { LibraryTagKeys } from "../../Icons";
import { LibraryStore } from "../../Store";
import { TextWithTerms } from "./GlossaryTextRenderer";
import styles from "./Markdown.module.css";
import { findArticleByReference } from "./referenceUtils";

const ReferenceLink = ({
	text,
	sectionName,
	chapterName,
	itemNumber,
	currentTag,
}) => {
	const translations = useTranslations();
	const tags = LibraryStore.useState((s) => s.tags);

	const handleClick = useCallback(
		(e) => {
			e.preventDefault();
			e.stopPropagation();

			const targetArticle = findArticleByReference(
				tags,
				sectionName,
				chapterName,
				currentTag,
			);
			if (targetArticle) {
				const path = itemNumber
					? `${targetArticle._id}:${itemNumber}`
					: targetArticle._id;
				setPath("library", "id", path);
			}
		},
		[tags, sectionName, chapterName, itemNumber, currentTag],
	);

	const targetArticle = findArticleByReference(
		tags,
		sectionName,
		chapterName,
		currentTag,
	);

	if (!targetArticle) {
		return <TextWithTerms text={text} />;
	}

	const tooltipContent = (
		<React.Fragment>
			<div style={{ fontWeight: "bold", marginBottom: "4px" }}>
				{translations?.NAVIGATE_TO || "Jump to:"}
			</div>
			{LibraryTagKeys.map((key) => {
				if (!targetArticle[key] || key === "number" || key === "title")
					return null;
				return (
					<div key={key}>
						<span style={{ color: "#aaa" }}>
							{key.charAt(0).toUpperCase() + key.slice(1)}:
						</span>{" "}
						{targetArticle[key]}
					</div>
				);
			})}
			{itemNumber && (
				<div>
					<span style={{ color: "#aaa" }}>Item:</span> {itemNumber}
				</div>
			)}
		</React.Fragment>
	);

	return (
		<span className={styles["reference-container"]}>
			<TextWithTerms text={text} />
			<Tooltip title={tooltipContent} arrow>
				<span
					data-prevent-select="true"
					onClick={handleClick}
					style={{
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						verticalAlign: "middle",
						marginLeft: "6px",
						marginTop: "-3px",
						cursor: "pointer",
						color: "var(--primary-main)",
						border: "1px solid var(--primary-main)",
						borderRadius: "50%",
						width: "18px",
						height: "18px",
						padding: "1px",
					}}
				>
					<ArrowForwardIcon style={{ fontSize: "0.9rem" }} />
				</span>
			</Tooltip>
		</span>
	);
};

ReferenceLink.displayName = "ReferenceLink";

export default ReferenceLink;
