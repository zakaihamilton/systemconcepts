import {
	type SortableLibraryNode,
	sortLibraryTree,
} from "@components/SideBar/LibraryTree/sortLibraryTree";
import { LibraryTagKeys } from "../Icons";

export function sortLibraryTags(tags: any[], customOrder: Record<string, any>) {
	if (!tags || tags.length === 0) return [];

	const root: SortableLibraryNode = {
		id: "root",
		name: "Library",
		children: [],
	};

	for (const tag of tags) {
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
			const idSuffix = nodeNumber ? `#${nodeNumber}` : "";

			pathIds.push(name + idSuffix);
			const id = pathIds.join("|");

			const existingNode = currentLevel.find((n) => n.id === id);
			const node: SortableLibraryNode = existingNode || {
				id,
				name,
				type,
				children: [],
				...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {}),
			};
			if (!existingNode) {
				currentLevel.push(node);
			}
			currentLevel = node.children;
		});
	}

	sortLibraryTree(root.children, customOrder);

	// Flatten the tree in depth-first order
	const flattened: any[] = [];
	const flatten = (nodes: SortableLibraryNode[]) => {
		nodes.forEach((node) => {
			if (node._id) {
				flattened.push(node);
			}
			if (node.children && node.children.length > 0) {
				flatten(node.children);
			}
		});
	};
	flatten(root.children);

	return flattened;
}
