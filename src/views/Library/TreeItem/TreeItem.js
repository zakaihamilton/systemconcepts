import { abbreviations } from "@data/abbreviations";
import ExpandLessIcon from "@icons/svg/ExpandLess.svg";
import ExpandMoreIcon from "@icons/svg/ExpandMore.svg";
import Box from "@ui/Box";
import Link from "@ui/Link";
import List from "@ui/List";
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
				e.preventDefault();
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
	const surfaceClassName = clsx(
		styles.itemSurface,
		level === 0 ? styles.itemSurfaceLevel0 : styles.itemSurfaceLevel,
		isSelected && styles.selected,
	);

	const rowContent = (
		<Box className={styles.contentWrapper}>
			<Box
				onClick={hasChildren ? (e) => handleToggle(e) : undefined}
				className={clsx(styles.toggleIcon, !hasChildren && styles.toggleHidden)}
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
					disableInteractive
				>
					<Box className={styles.iconWrapper}>
						<Icon className={styles.typeIcon} />
					</Box>
				</Tooltip>
			)}

			{node.number && <Box className={styles.tagNumber}>{node.number}</Box>}
			<Box className={styles.textArea}>
				<Tooltip
					title={isTruncated ? name : ""}
					enterDelay={0}
					disableHoverListener={!isTruncated}
					disableInteractive
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
		</Box>
	);

	return (
		<Box className={styles.treeItem}>
			<Box className={styles.itemRow} ref={itemRef}>
				{node._id ? (
					<Link
						href={`#library/id/${node._id}`}
						color="inherit"
						underline="none"
						className={surfaceClassName}
						onClick={handleSelect}
					>
						{rowContent}
					</Link>
				) : (
					<button
						type="button"
						className={surfaceClassName}
						onClick={handleSelect}
					>
						{rowContent}
					</button>
				)}
			</Box>
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
