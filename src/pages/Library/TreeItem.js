import { useState, useEffect, useCallback, memo } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

const TreeItem = memo(function TreeItem({ node, onSelect, selectedId, selectedPath, level = 0 }) {
    const [open, setOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = !!selectedId && node._id === selectedId;

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
                sx={{
                    pl: level === 0 ? 1 : 2,
                    py: 0.25,
                    minHeight: 32,
                    "&.Mui-selected": {
                        bgcolor: "action.selected"
                    }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                    <Box
                        onClick={hasChildren ? handleToggle : undefined}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            mr: 0.5,
                            cursor: hasChildren ? "pointer" : "default",
                            color: "text.secondary",
                            flexShrink: 0,
                            "&:hover": hasChildren ? { color: "primary.main" } : {}
                        }}
                    >
                        {hasChildren ? (
                            open ?
                                <RemoveIcon sx={{ fontSize: 16, border: "1px solid", borderRadius: 0.5 }} /> :
                                <AddIcon sx={{ fontSize: 16, border: "1px solid", borderRadius: 0.5 }} />
                        ) : (
                            <Box sx={{ width: 16 }} />
                        )}
                    </Box>

                    {Icon && (
                        <Icon sx={{ fontSize: 18, mr: 1, color: "text.secondary", flexShrink: 0 }} />
                    )}

                    {node.number && (
                        <Box
                            sx={{
                                mr: 1,
                                px: 0.6,
                                py: 0.1,
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                borderRadius: 1.5,
                                fontSize: "0.7rem",
                                fontWeight: "bold",
                                minWidth: 18,
                                textAlign: "center",
                                flexShrink: 0
                            }}
                        >
                            {node.number}
                        </Box>
                    )}
                    <ListItemText
                        primary={
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: "0.85rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {node.name}
                            </Typography>
                        }
                        sx={{ minWidth: 0 }}
                    />
                </Box>
            </ListItemButton>
            {hasChildren && open && (
                <List
                    component="div"
                    disablePadding
                    sx={{
                        ml: (level === 0 ? 1 : 2) + 1.5,
                        borderLeft: "1px solid",
                        borderColor: "divider",
                        pl: 0.5
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
