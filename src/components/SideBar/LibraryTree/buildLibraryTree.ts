import { LibraryIcons, LibraryTagKeys } from "@views/Library/Icons";
import { type SortableLibraryNode, sortLibraryTree } from "./sortLibraryTree";

export type LibraryTreeNode = SortableLibraryNode & {
	Icon?: any;
	children: LibraryTreeNode[];
};

function filterTagsByQuery(tags: any[], filterText: string): any[] {
	if (!filterText) return tags;

	const lowerFilter = filterText.toLowerCase();
	const keysToSearch = [
		...LibraryTagKeys.filter((k) => k !== "author"),
		"number",
	];
	const terms = lowerFilter.split(/\s+/).filter(Boolean);

	return tags.filter((tag) => {
		const values = keysToSearch
			.map((key) => tag[key])
			.filter((v) => v && String(v).trim())
			.map((v) => String(v).toLowerCase());
		const allValues = values.join(" ");

		if (terms.includes("or")) {
			const groups = lowerFilter.split(/\s+or\s+/).filter(Boolean);
			return groups.some((group) => {
				const groupTerms = group.split(/\s+/).filter(Boolean);
				return groupTerms.every((term) => allValues.includes(term));
			});
		}

		return terms.every((term) => allValues.includes(term));
	});
}

/**
 * Filters library tags and constructs a sorted hierarchical tree for sidebar rendering.
 */
export function buildLibraryTree(
	tags: any[],
	filterText: string,
	customOrder: Record<string, any>,
): LibraryTreeNode[] {
	const root: LibraryTreeNode = { id: "root", name: "Library", children: [] };
	const filteredTags = filterTagsByQuery(tags, filterText);

	for (const tag of filteredTags) {
		let currentLevel = root.children;
		const levels = LibraryTagKeys.map((key) => ({ key, value: tag[key] }))
			.filter((item) => item.value && String(item.value).trim())
			.map((item) => ({ key: item.key, value: String(item.value).trim() }));
		if (levels.length === 0) continue;

		const pathIds: string[] = [];
		levels.forEach((levelItem, index) => {
			const { key: type, value: name } = levelItem;
			const isHead = index < levels.length - 1;
			const nodeNumber = !isHead && tag.number ? tag.number : null;
			const idSuffix = nodeNumber ? `:${nodeNumber}` : "";

			pathIds.push(name + idSuffix);
			const id = pathIds.join("|");

			const existingNode = currentLevel.find((n) => n.id === id);
			let node: LibraryTreeNode;
			if (existingNode) {
				node = existingNode;
			} else {
				const Icon = (LibraryIcons as Record<string, any>)[type];
				node = {
					id,
					name,
					type,
					Icon,
					children: [],
					...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {}),
				};
				currentLevel.push(node);
			}
			currentLevel = node.children;
		});
	}

	sortLibraryTree(root.children, customOrder);
	return root.children;
}
