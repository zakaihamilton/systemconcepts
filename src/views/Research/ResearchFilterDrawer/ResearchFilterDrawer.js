import ClearIcon from "@icons/svg/Clear.svg";
import SearchIcon from "@icons/svg/Search.svg";
import Box from "@ui/Box";
import Button from "@ui/Button";
import Drawer from "@ui/Drawer";
import IconButton from "@ui/IconButton";
import InputAdornment from "@ui/InputAdornment";
import List from "@ui/List";
import ListItem from "@ui/ListItem";
import ListItemButton from "@ui/ListItemButton";
import ListItemText from "@ui/ListItemText";
import TextField from "@ui/TextField";
import Typography from "@ui/Typography";
import { useCallback, useMemo, useState } from "react";
import styles from "../Research.module.css";

export default function ResearchFilterDrawer({
	open,
	onClose,
	filterTags,
	availableFilters,
	translations,
	setFilterTags,
	onToggleFilter,
}) {
	const [filterListQuery, setFilterListQuery] = useState("");

	const filterGroups = useMemo(() => {
		return availableFilters.reduce((groups, filter) => {
			(groups[filter.type] ||= []).push(filter);
			return groups;
		}, {});
	}, [availableFilters]);

	const visibleFilterGroups = useMemo(() => {
		const needle = filterListQuery.trim().toLowerCase();
		if (!needle) return filterGroups;
		return Object.fromEntries(
			Object.entries(filterGroups)
				.map(([type, filters]) => [
					type,
					filters.filter((filter) =>
						filter.label.toLowerCase().includes(needle),
					),
				])
				.filter(([, filters]) => filters.length > 0),
		);
	}, [filterGroups, filterListQuery]);

	const closeFilterDrawer = useCallback(() => {
		setFilterListQuery("");
		onClose();
	}, [onClose]);

	return (
		<Drawer
			open={open}
			onClose={closeFilterDrawer}
			anchor="right"
			className={styles.filterDrawer}
			style={{ zIndex: 1500 }}
		>
			<Box className={styles.drawerContent}>
				<Box className={styles.drawerHeader}>
					<Typography variant="h6">
						{translations.FILTERS || "Filters"}
					</Typography>
					<IconButton
						aria-label={translations.CLOSE || "Close"}
						onClick={closeFilterDrawer}
					>
						<ClearIcon />
					</IconButton>
				</Box>
				<TextField
					fullWidth
					variant="outlined"
					className={styles.filterSearch}
					placeholder={translations.SEARCH_FILTERS || "Search filters..."}
					value={filterListQuery}
					onChange={(e) => setFilterListQuery(e.target.value)}
					startAdornment={
						<InputAdornment position="start">
							<SearchIcon />
						</InputAdornment>
					}
					endAdornment={
						filterListQuery ? (
							<InputAdornment position="end">
								<IconButton
									aria-label={translations.CLEAR || "Clear search"}
									onClick={() => setFilterListQuery("")}
									size="small"
								>
									<ClearIcon fontSize="small" />
								</IconButton>
							</InputAdornment>
						) : null
					}
				/>
				{Object.entries(visibleFilterGroups).map(([type, filters]) => (
					<Box key={type} className={styles.filterGroup}>
						<Typography variant="caption" className={styles.filterGroupTitle}>
							{translations[type.toUpperCase()] || type}
						</Typography>
						<List disablePadding className={styles.filterChoices}>
							{filters.map((filter) => {
								const selected = filterTags.some(
									(tag) =>
										tag.label === filter.label && tag.type === filter.type,
								);
								return (
									<ListItem
										key={`${filter.type}-${filter.label}`}
										disablePadding
									>
										<ListItemButton
											selected={selected}
											onClick={() => onToggleFilter(filter)}
										>
											<ListItemText primary={filter.label} />
										</ListItemButton>
									</ListItem>
								);
							})}
						</List>
					</Box>
				))}
				<Box className={styles.drawerActions}>
					<Button variant="text" onClick={() => setFilterTags([])}>
						{translations.CLEAR_ALL || "Clear all"}
					</Button>
					<Button variant="contained" onClick={closeFilterDrawer}>
						{translations.DONE || "Done"}
					</Button>
				</Box>
			</Box>
		</Drawer>
	);
}
