import { useState, useEffect, useCallback, memo, useRef } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import styles from "./TreeItem.module.scss";
import clsx from "clsx";

const TreeItem = memo(function TreeItem({ node, onSelect, selectedId, selectedPath, level = 0 }) {
    const [open, setOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = !!selectedId && node._id === selectedId;
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef(null);

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
        if (selectedPath && node.id !== "root" && (selectedPath === node.id || selectedPath.startsWith(node.id + "|"))) {
            setOpen(true);
        }
    }, [selectedPath, node.id]);

    const handleToggle = useCallback((e) => {
        e.stopPropagation();
        setOpen(prev => !prev);
    }, []);

    const handleSelect = useCallback(() => {
        if (!hasChildren) {
            onSelect(node);
        } else {
            setOpen(prev => !prev);
        }
    }, [hasChildren, onSelect, node]);

    const Icon = node.Icon;

    return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
            <ListItemButton
                onClick={handleSelect}
                selected={isSelected}
                className={clsx(styles.itemButton, isSelected && styles.selected)}
                sx={{
                    pl: level === 0 ? 1 : 1.5
                }}
            >
                <Box className={styles.contentWrapper}>
                    <Box
                        onClick={hasChildren ? handleToggle : undefined}
                        className={clsx(styles.toggleIcon, open ? styles.open : styles.closed)}
                    >
                        {hasChildren ? (
                            <Box
                                component="span"
                                className={styles.chevron}
                            />
                        ) : (
                            <Box className={styles.dot} />
                        )}
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
                            selectedId={selectedId}
                            selectedPath={selectedPath}
                            level={level + 1}
                        />
                    ))}
                </List>
            )}
        </Box>
    );
});

export default TreeItem;
