import { useCallback, useRef } from "react";

export function useSessionTreeGrouping() {
	const treeGroupCache = useRef<Record<string, any>>({});
	return useCallback((sortedItems: any, expandedTreeGroupsList: any) => {
		let collapsedResult: any;
		let groups: any;

		if (treeGroupCache.current.sortedItems === sortedItems) {
			collapsedResult = treeGroupCache.current.result;
			groups = treeGroupCache.current.groups;
		} else {
			groups = {};
			const groupOrder: any = [];

			sortedItems.forEach((itemWrapper: any) => {
				const { mapped } = itemWrapper;
				const groupKey = mapped.treeGroupKey;
				if (!groups[groupKey]) {
					groups[groupKey] = { prefix: mapped.treePrefix, items: [] };
					groupOrder.push(groupKey);
				}
				groups[groupKey].items.push(itemWrapper);
			});

			collapsedResult = [];
			groupOrder.forEach((groupKey: any) => {
				const { prefix, items }: any = groups[groupKey];
				if (items.length === 1) {
					collapsedResult.push(items[0]);
				} else {
					const firstItem = items[0];
					const headerMapped = {
						...firstItem.mapped,
						id: "group_" + groupKey,
						key: "group_" + groupKey,
						isGroupHeader: true,
						prefix: groupKey,
						name: prefix,
						count: items.length,
					};
					collapsedResult.push({
						raw: { ...firstItem.raw, isGroupHeader: true },
						mapped: headerMapped,
						searchableText: prefix.toLowerCase(),
					});
				}
			});

			treeGroupCache.current = {
				sortedItems,
				result: collapsedResult,
				groups,
			};
		}

		if (!expandedTreeGroupsList.length) {
			return collapsedResult;
		}

		const finalResult = [];
		const expandedSet = new Set(expandedTreeGroupsList);

		for (const item of collapsedResult) {
			const isExpanded =
				item.mapped.isGroupHeader && expandedSet.has(item.mapped.prefix);

			if (isExpanded) {
				const expandedGroup = groups[item.mapped.prefix];
				// Push the header with expanded state
				finalResult.push({
					...item,
					mapped: { ...item.mapped, isExpanded: true },
				});
				// Push the children if the group exists
				if (expandedGroup) {
					const treeChildren = expandedGroup.items.map((child: any) => ({
						raw: child.raw,
						mapped: { ...child.mapped, isTreeChild: true },
					}));
					finalResult.push(...treeChildren);
				}
			} else {
				// Push the collapsed item or non-header item
				finalResult.push(item);
			}
		}

		return finalResult;
	}, []);
}
