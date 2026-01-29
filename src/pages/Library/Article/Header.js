import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import { LibraryTagKeys, LibraryIcons } from "../Icons";
import { abbreviations } from "../../../data/abbreviations";
import clsx from "clsx";
import styles from "../Article.module.scss";

export default function Header({
    selectedTag,
    isHeaderHidden,
    showAbbreviations,
    title,
    translations,
    currentParagraphIndex,
    onTitleClick
}) {
    const handleTagKeyPress = (e, value) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigator.clipboard.writeText(value);
        }
    };

    const isTitleSelected = currentParagraphIndex === -2;
    const isTagsSelected = currentParagraphIndex === -3;

    return (
        <Box
            component="header"
            role="banner"
            className={clsx(
                styles.stickyHeader,
                isHeaderHidden && !isTitleSelected && !isTagsSelected && styles.hidden,
                (isTitleSelected || isTagsSelected) && styles.headerSelected
            )}
            aria-label={selectedTag?.article || "Article Header"}
        >
            <Box className={styles.headerContent}>
                <Box className={styles.headerInfo}>
                    <Box className={styles.headerTitleWrapper}>
                        <Box className={styles.titleRow}>
                            {selectedTag?.number && (
                                <Paper
                                    elevation={0}
                                    className={styles.tagNumber}
                                    component="span"
                                    aria-label={`Tag number: ${selectedTag.number}`}
                                >
                                    #{selectedTag.number}
                                </Paper>
                            )}
                            {" "}
                            <Typography
                                variant="h4"
                                className={styles.title}
                                component="h1"
                                onClick={onTitleClick}
                                sx={onTitleClick ? { cursor: "pointer", "&:hover": { textDecoration: "underline" } } : undefined}
                            >
                                {(() => {
                                    const expansion = abbreviations[title.name];
                                    return (!showAbbreviations && expansion) ? expansion.eng : title.name;
                                })()}
                            </Typography>
                        </Box>
                        <Box
                            className={styles.metadataRow}
                            role="list"
                            aria-label="Metadata tags"
                        >
                            {LibraryTagKeys.filter(key => key !== "book" && key !== "author")
                                .concat(["book", "author"])
                                .map(key => {
                                    if (!selectedTag?.[key] || key === "number") return null;
                                    if (title.key === key) return null;
                                    const value = selectedTag[key];
                                    if (title.name === value) return null;
                                    const Icon = LibraryIcons[key];
                                    const expansion = abbreviations[value];
                                    const displayValue = (!showAbbreviations && expansion) ? expansion.eng : value;
                                    const label = translations?.[key.toUpperCase()] || key.charAt(0).toUpperCase() + key.slice(1);

                                    return (
                                        <Tooltip key={key} title={`${label}: ${displayValue}`} arrow>
                                            <Paper
                                                elevation={0}
                                                className={styles.metadataTag}
                                                data-key={key}
                                                role="listitem"
                                                tabIndex={0}
                                                aria-label={`${label}: ${displayValue}`}
                                                onClick={() => navigator.clipboard.writeText(displayValue)}
                                                onKeyDown={(e) => handleTagKeyPress(e, displayValue)}
                                                sx={{ cursor: "pointer", display: 'flex', alignItems: 'center' }}
                                            >
                                                {Icon && <Icon sx={{ fontSize: "1rem" }} aria-hidden="true" />}
                                                <Typography variant="caption">{displayValue}</Typography>
                                            </Paper>
                                        </Tooltip>
                                    );
                                })}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
