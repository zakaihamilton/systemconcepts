import ArrowDownwardIcon from "@icons/svg/ArrowDownward.svg";
import ArrowUpwardIcon from "@icons/svg/ArrowUpward.svg";
import { getComparator, stableSort } from "@util/data/sort";
import { useCallback, useMemo } from "react";

export function useTableData({
	columns,
	store,
	viewMode,
	data,
	filter,
	mapper,
	depends,
	search,
	treeGroup,
	expandedTreeGroups,
	onExport,
	onImport,
	order,
	orderBy,
	itemsPerPage,
}: any) {
	const visibleColumns = useMemo(
		() =>
			columns.filter((column: any) => {
				if (!column) {
					return false;
				}
				if (typeof column.visible !== "undefined" && !column.visible) {
					return false;
				}
				if (column.viewModes) {
					return column.viewModes.hasOwnProperty(viewMode);
				}
				return true;
			}),
		[columns, viewMode],
	);

	const createSortHandler = useCallback(
		(property: any) => () => {
			const isDesc = orderBy === property && order === "desc";
			store.update((s: any) => {
				s.order = isDesc ? "asc" : "desc";
				s.orderBy = property;
			});
		},
		[order, orderBy, store],
	);

	const sortItems = useMemo(() => {
		return (columns || [])
			.filter((column: any) => column.sortable)
			.map((column: any) => {
				const { sortable, id, title } = column;
				const sortId = typeof sortable === "string" ? sortable : id;
				return {
					id: id,
					name: title,
					icon:
						orderBy === sortId ? (
							order === "asc" ? (
								<ArrowUpwardIcon />
							) : (
								<ArrowDownwardIcon />
							)
						) : null,
					selected: orderBy === sortId,
					onClick: createSortHandler(sortId),
				};
			});
	}, [columns, orderBy, order, createSortHandler]);

	const itemsPerPageItems = useMemo(() => {
		return [10, 25, 50, 75, 100].map((num) => {
			return {
				id: num,
				name: num,
				icon: null,
				selected: itemsPerPage,
				onClick: () =>
					store.update((s: any) => {
						s.itemsPerPage = num;
					}),
			};
		});
	}, [itemsPerPage, store]);

	const searchKeys = useMemo(() => {
		return columns
			.filter(
				(item: any) =>
					typeof item.searchable === "undefined" || item.searchable,
			)
			.map((item: any) => {
				if (typeof item.searchable === "string") {
					return item.searchable;
				}
				if (typeof item.sortable === "string") {
					return item.sortable;
				}
				return item.id;
			});
	}, [columns]);

	const mappedData = useMemo(() => {
		let raw = data || [];
		if (filter) {
			raw = raw.filter(filter);
		}

		return raw.map((item: any) => {
			const mapped = mapper ? mapper(item) : item;
			const searchableText = searchKeys
				.map((key: any) => {
					const val = mapped[key];
					return typeof val === "string" ? val.toLowerCase() : "";
				})
				.join("\0");

			return {
				raw: item,
				mapped,
				searchableText,
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data, filter, mapper, searchKeys, ...depends]);

	const filteredData = useMemo(() => {
		if (!search) {
			return mappedData;
		}

		if (search.toLowerCase() === "@doublespace") {
			return mappedData.filter(({ mapped }: any) => {
				const nameHasDoubleSpace = mapped.name && /  /.test(mapped.name);
				const fullName = `${mapped.date || ""} ${mapped.name || ""}`;
				const fullNameHasDoubleSpace = /  /.test(fullName);
				return nameHasDoubleSpace || fullNameHasDoubleSpace;
			});
		}

		const parseSearchQuery: any = (query: any) => {
			const extractTerms = (str: any) => {
				const terms = [];
				const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
				let match;
				while ((match = regex.exec(str)) !== null) {
					const term = match[1] || match[2] || match[3];
					if (term && term.toLowerCase() !== "and") {
						terms.push(term);
					}
				}
				return terms;
			};

			const quotedStrings: any = [];
			let processedQuery = query.replace(/"[^"]+"|'[^']+'/g, (match: any) => {
				quotedStrings.push(match);
				return `__QUOTED_${quotedStrings.length - 1}__`;
			});

			const orParts = processedQuery.split(/\s+or\s+/i);

			return orParts
				.map((part: any) => {
					let restored = part;
					quotedStrings.forEach((qs: any, idx: any) => {
						restored = restored.replace(`__QUOTED_${idx}__`, qs);
					});
					return extractTerms(restored);
				})
				.filter((group: any) => group.length > 0);
		};

		const matchesTerm = (itemWrapper: any, term: any) => {
			const lowerTerm = term.toLowerCase();
			return itemWrapper.searchableText.includes(lowerTerm);
		};

		const matchesQuery = (itemWrapper: any, orGroups: any) => {
			return orGroups.some((andTerms: any) =>
				andTerms.every((term: any) => matchesTerm(itemWrapper, term)),
			);
		};

		const orGroups = parseSearchQuery(search);

		return mappedData.filter((itemWrapper: any) =>
			matchesQuery(itemWrapper, orGroups),
		);
	}, [mappedData, search]);

	const purelySortedData = useMemo(() => {
		return stableSort(filteredData || [], (a: any, b: any) =>
			getComparator(order, orderBy)(a.mapped, b.mapped),
		);
	}, [filteredData, order, orderBy]);

	const sortedData = useMemo(() => {
		let sorted = purelySortedData;
		if (viewMode === "tree" && treeGroup) {
			sorted = treeGroup(purelySortedData, expandedTreeGroups || []);
		}
		return sorted;
	}, [purelySortedData, viewMode, treeGroup, expandedTreeGroups]);

	const items = useMemo(
		() => sortedData.map((item: any) => item.mapped),
		[sortedData],
	);

	const rawItems = useMemo(
		() =>
			onExport || onImport ? sortedData.map((item: any) => item.raw) : null,
		[onExport, onImport, sortedData],
	);

	return {
		visibleColumns,
		createSortHandler,
		sortItems,
		itemsPerPageItems,
		searchKeys,
		mappedData,
		filteredData,
		purelySortedData,
		sortedData,
		items,
		rawItems,
	};
}
