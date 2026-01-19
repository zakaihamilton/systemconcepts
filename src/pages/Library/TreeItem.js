import { useState, useEffect, useCallback, memo, useRef } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "./TreeItem.module.scss";
import clsx from "clsx";
import { LibraryStore } from "./Store";

const TreeItem = memo(function TreeItem({ node, onSelect, onToggle, level = 0 }) {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = LibraryStore.useState(s => s.selectedId === node._id);
    const selectPath = LibraryStore.useState(s => s.selectPath);
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef(null);
    const itemRef = useRef(null);
    const expandedNodes = LibraryStore.useState(s => s.expandedNodes);
    const open = expandedNodes.includes(node.id);

    const checkTruncation = useCallback(() => {
        if (textRef.current) {
            setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
        }
    }, []);

    useEffect(() => {
        checkTruncation();
        window.addEventListener('resize', checkTruncation);
        return () => window.removeEventListener('resize', checkTruncation);
    }, [node.name, checkTruncation]);

    useEffect(() => {
        if (selectPath && node.id && node.id !== "root" && (selectPath === node.id || selectPath.startsWith(node.id + "|"))) {
            if (!open) {
                LibraryStore.update(s => {
                    if (!s.expandedNodes.includes(node.id)) {
                        s.expandedNodes = [...s.expandedNodes, node.id];
                    }
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectPath, node.id]);

    useEffect(() => {
        if ((isSelected || selectPath === node.id) && itemRef.current) {
            const timer = setTimeout(() => {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isSelected, selectPath, node.id]);

    const handleToggle = useCallback((e) => {
        if (e) {
            e.stopPropagation();
        }
        if (onToggle) {
            onToggle(node.id, !open);
        } else {
            LibraryStore.update(s => {
                if (s.expandedNodes.includes(node.id)) {
                    s.expandedNodes = s.expandedNodes.filter(id => id !== node.id);
                } else {
                    s.expandedNodes = [...s.expandedNodes, node.id];
                }
            });
        }
    }, [node.id, open, onToggle]);

    useEffect(() => {
        if (open && itemRef.current) {
            const timer = setTimeout(() => {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const handleChildToggle = useCallback((childId, isExpanding) => {
        if (isExpanding) {
            const siblingIds = node.children.map(c => c.id).filter(id => id !== childId);
            LibraryStore.update(s => {
                s.expandedNodes = s.expandedNodes.filter(id => !siblingIds.includes(id));
                if (!s.expandedNodes.includes(childId)) {
                    s.expandedNodes = [...s.expandedNodes, childId];
                }
            });
        } else {
            LibraryStore.update(s => {
                s.expandedNodes = s.expandedNodes.filter(id => id !== childId);
            });
        }
    }, [node.children]);

    const handleSelect = useCallback(() => {
        if (!hasChildren) {
            onSelect(node);
        } else {
            handleToggle();
        }
    }, [hasChildren, onSelect, node, handleToggle]);

    const Icon = node.Icon;

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            <ListItemButton
                ref={itemRef}
                onClick={handleSelect}
                selected={isSelected}
                className={clsx(styles.itemButton, isSelected && styles.selected)}
                sx={{
                    pl: level === 0 ? 1 : 1.5
                }}
            >
                <Box className={styles.contentWrapper}>
                    <Box
                        onClick={hasChildren ? (e) => handleToggle(e) : undefined}
                        className={styles.toggleIcon}
                        sx={{ visibility: hasChildren ? "visible" : "hidden" }}
                    >
                        {open ? <ExpandLessIcon className={styles.expandIcon} /> : <ExpandMoreIcon className={styles.expandIcon} />}
                    </Box>

                    {Icon && (
                        <Tooltip title={(node.type || "").charAt(0).toUpperCase() + (node.type || "").slice(1)} enterDelay={500}>
                            <Box className={styles.iconWrapper}>
                                <Icon sx={{ fontSize: "inherit" }} />
                            </Box>
                        </Tooltip>
                    )}

                    {node.number && (
                        <Box className={styles.tagNumber}>
                            {node.number}
                        </Box>
                    )}
                    <Tooltip
                        title={isTruncated ? node.name : ""}
                        enterDelay={0}
                        disableHoverListener={!isTruncated}
                        placement="bottom-start"
                        slotProps={{
                            popper: {
                                sx: {
                                    pointerEvents: "none"
                                },
                                modifiers: [
                                    {
                                        name: 'offset',
                                        options: {
                                            offset: [-9, -38],
                                        },
                                    },
                                ],
                            },
                            tooltip: {
                                sx: {
                                    maxWidth: 500,
                                    fontSize: "0.85rem",
                                    pointerEvents: "none"
                                }
                            }
                        }}
                    >
                        <ListItemText
                            primary={
                                <Typography
                                    ref={textRef}
                                    variant="body2"
                                    onMouseEnter={checkTruncation}
                                    className={clsx(styles.name, hasChildren ? styles.parentName : styles.childName)}
                                >
                                    {node.name}
                                </Typography>
                            }
                            sx={{ minWidth: 0 }}
                        />
                    </Tooltip>
                </Box>
            </ListItemButton>
            {hasChildren && open && (
                <List
                    component="div"
                    disablePadding
                    className={styles.childList}
                    sx={{
                        ml: (level === 0 ? 1 : 1.5) + 1
                    }}
                >
                    {node.children.map((child) => (
                        <TreeItem
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            onToggle={handleChildToggle}
                            level={level + 1}
                        />
                    ))}
                </List>
            )}
        </Box>
    );
});

export default TreeItem;
