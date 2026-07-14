import { abbreviations } from "@data/abbreviations";
import ExpandLessIcon from "@icons/ExpandLess";
import ExpandMoreIcon from "@icons/ExpandMore";
import Box from "@ui/Box";
import List from "@ui/List";
import ListItemButton from "@ui/ListItemButton";
import ListItemText from "@ui/ListItemText";
import Typography from "@ui/Typography";
import Tooltip from "@widgets/Tooltip";
import clsx from "clsx";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { LibraryStore } from "../Store";
import styles from "./TreeItem.module.css";

const TreeItem = memo(function TreeItem({
	node,
	onSelect,
	onToggle,
	level = 0,
}) {
	const hasChildren = node.children && node.children.length > 0;
	const isSelected = LibraryStore.useState((s) => s.selectedId === node._id);
	const selectPath = LibraryStore.useState((s) => s.selectPath);
	const [isTruncated, setIsTruncated] = useState(false);
	const textRef = useRef(null);
	const itemRef = useRef(null);
	const expandedNodes = LibraryStore.useState((s) => s.expandedNodes);
	const open = expandedNodes.includes(node.id);
	const expansion = abbreviations[node.name];
	const name = expansion ? expansion.eng : node.name;

	// Use Store to track clicks across possible remounts
	const clickedId = LibraryStore.useState((s) => s.clickedId);

	const checkTruncation = useCallback(() => {
		if (textRef.current) {
			setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
		}
	}, []);

	useEffect(() => {
		checkTruncation();
		window.addEventListener("resize", checkTruncation);
		return () => window.removeEventListener("resize", checkTruncation);
	}, [name, checkTruncation]);

	useEffect(() => {
		if (
			selectPath &&
			node.id &&
			node.id !== "root" &&
			(selectPath === node.id || selectPath.startsWith(node.id + "|"))
		) {
			if (!open) {
				LibraryStore.update((s) => {
					if (!s.expandedNodes.includes(node.id)) {
						s.expandedNodes = [...s.expandedNodes, node.id];
					}
				});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectPath, node.id]);

	// Center the selected item only if it wasn't manually clicked in the tree
	useEffect(() => {
		if (selectPath === node.id && itemRef.current) {
			if (clickedId === node.id) {
				// Already visible via click or toggle, do not scroll
				return;
			}
			const timer = setTimeout(() => {
				if (itemRef.current) {
					itemRef.current.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
				}
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [selectPath, node.id, clickedId]);

	const handleToggle = useCallback(
		(e) => {
			if (e) {
				e.stopPropagation();
			}
			LibraryStore.update((s) => {
				s.clickedId = node.id;
			});
			if (onToggle) {
				onToggle(node.id, !open);
			} else {
				LibraryStore.update((s) => {
					if (s.expandedNodes.includes(node.id)) {
						s.expandedNodes = s.expandedNodes.filter((id) => id !== node.id);
					} else {
						s.expandedNodes = [...s.expandedNodes, node.id];
					}
				});
			}
		},
		[node.id, open, onToggle],
	);

	const handleChildToggle = useCallback(
		(childId, isExpanding) => {
			if (isExpanding) {
				const siblingIds = node.children
					.map((c) => c.id)
					.filter((id) => id !== childId);
				LibraryStore.update((s) => {
					s.expandedNodes = s.expandedNodes.filter(
						(id) => !siblingIds.includes(id),
					);
					if (!s.expandedNodes.includes(childId)) {
						s.expandedNodes = [...s.expandedNodes, childId];
					}
				});
			} else {
				LibraryStore.update((s) => {
					s.expandedNodes = s.expandedNodes.filter((id) => id !== childId);
				});
			}
		},
		[node.children],
	);

	const handleSelect = useCallback(
		(e) => {
			if (e) {
				e.preventDefault();
			}
			LibraryStore.update((s) => {
				s.clickedId = node.id;
			});
			// Clear clickedId after a delay to allow future programmatic scrolling to this node
			setTimeout(() => {
				LibraryStore.update((s) => {
					if (s.clickedId === node.id) {
						s.clickedId = null;
					}
				});
			}, 2000);

			if (!hasChildren) {
				onSelect(node);
			} else {
				handleToggle();
			}
		},
		[hasChildren, onSelect, node, handleToggle],
	);

	const Icon = node.Icon;

	return (
		<Box className={styles.treeItem}>
			<ListItemButton
				component={node._id ? "a" : "div"}
				href={node._id ? `#library/id/${node._id}` : undefined}
				ref={itemRef}
				onClick={handleSelect}
				selected={isSelected}
				className={clsx(
					styles.itemButton,
					styles.itemButtonLink,
					level === 0 ? styles.itemButtonLevel0 : styles.itemButtonLevel,
					isSelected && styles.selected,
				)}
			>
				<Box className={styles.contentWrapper}>
					<Box
						onClick={hasChildren ? (e) => handleToggle(e) : undefined}
						className={clsx(
							styles.toggleIcon,
							!hasChildren && styles.toggleHidden,
						)}
					>
						{open ? (
							<ExpandLessIcon className={styles.expandIcon} />
						) : (
							<ExpandMoreIcon className={styles.expandIcon} />
						)}
					</Box>

					{Icon && (
						<Tooltip
							title={
								(node.type || "").charAt(0).toUpperCase() +
								(node.type || "").slice(1)
							}
							enterDelay={500}
						>
							<Box className={styles.iconWrapper}>
								<Icon className={styles.typeIcon} />
							</Box>
						</Tooltip>
					)}

					{node.number && <Box className={styles.tagNumber}>{node.number}</Box>}
					<Tooltip
						title={isTruncated ? name : ""}
						enterDelay={0}
						disableHoverListener={!isTruncated}
						placement="bottom-start"
					>
						<ListItemText
							className={styles.listItemText}
							primary={
								<Typography
									ref={textRef}
									variant="body2"
									onMouseEnter={checkTruncation}
									className={clsx(
										styles.name,
										hasChildren ? styles.parentName : styles.childName,
									)}
								>
									{name}
								</Typography>
							}
						/>
					</Tooltip>
				</Box>
			</ListItemButton>
			{hasChildren && open && (
				<List
					component="div"
					disablePadding
					className={styles.childList}
					style={{ marginLeft: `${(level === 0 ? 1 : 1.5) + 1}rem` }}
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
