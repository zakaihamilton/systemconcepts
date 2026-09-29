import { LibraryTagKeys } from "../Icons";

type LibraryTreeNode = {
	id: string;
	name: string;
	type?: string;
	children: LibraryTreeNode[];
	[key: string]: any;
};

export function sortLibraryTags(tags: any[], customOrder: Record<string, any>) {
	if (!tags || tags.length === 0) return [];

	// We need to build the same tree structure as Tags.js and flatten it
	// Import the same sorting logic
	const root: LibraryTreeNode = { id: "root", name: "Library", children: [] };

	for (const tag of tags) {
		let currentLevel = root.children;
		const levels = LibraryTagKeys.map((key) => ({ key, value: tag[key] }))
			.filter((item) => item.value && String(item.value).trim())
			.map((item) => ({ key: item.key, value: String(item.value).trim() }));
		if (levels.length === 0) continue;

		const pathIds: any = [];
		levels.forEach((levelItem, index) => {
			const { key: type, value: name } = levelItem;
			const isHead = index < levels.length - 1;
			const nodeNumber = !isHead && tag.number ? tag.number : null;
			const idSuffix = nodeNumber ? `#${nodeNumber}` : "";

			pathIds.push(name + idSuffix);
			const id: any = pathIds.join("|");

			const existingNode = currentLevel.find((n) => n.id === id);
			const node: LibraryTreeNode = existingNode || {
				id,
				name,
				type,
				children: [] as LibraryTreeNode[],
				...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {}),
			};
			if (!existingNode) {
				currentLevel.push(node);
			}
			currentLevel = node.children;
		});
	}

	// Use the same sorting logic as Tags.js
	const numberWords: Record<string, number> = {
		one: 1,
		two: 2,
		three: 3,
		four: 4,
		five: 5,
		six: 6,
		seven: 7,
		eight: 8,
		nine: 9,
		ten: 10,
		eleven: 11,
		twelve: 12,
		thirteen: 13,
		fourteen: 14,
		fifteen: 15,
		sixteen: 16,
		seventeen: 17,
		eighteen: 18,
		nineteen: 19,
		twenty: 20,
		first: 1,
		second: 2,
		third: 3,
		fourth: 4,
		fifth: 5,
		sixth: 6,
		seventh: 7,
		eighth: 8,
		ninth: 9,
		tenth: 10,
	};

	const getPriority = (name: any) => {
		if (!name) return 999;
		const lowerName = name.toLowerCase().replace(/['']/g, "'");
		if (lowerName.includes("editor") && lowerName.includes("note")) return 0;
		if (lowerName.startsWith("intro")) return 1;
		if (lowerName.startsWith("preface")) return 2;
		if (lowerName.startsWith("foreword")) return 3;
		if (lowerName.startsWith("prologue")) return 4;
		if (
			lowerName.startsWith("contents") ||
			lowerName.includes("table of contents")
		)
			return 5;
		return 999;
	};

	const extractNumber = (name: any) => {
		if (!name) return null;
		const lowerName = name.toLowerCase();
		const candidates = [];
		const digitRegex = /(\d+)/g;
		let digitMatch;
		while ((digitMatch = digitRegex.exec(name)) !== null) {
			candidates.push({
				position: digitMatch.index,
				value: parseInt(digitMatch[1], 10),
			});
		}
		const wordRegex = /[a-z]+/gi;
		let wordMatch;
		while ((wordMatch = wordRegex.exec(lowerName)) !== null) {
			const word = wordMatch[0];
			if (numberWords[word] !== undefined) {
				candidates.push({
					position: wordMatch.index,
					value: numberWords[word],
				});
			}
		}
		if (candidates.length === 0) return null;
		candidates.sort((a, b) => a.position - b.position);
		return candidates[0];
	};

	const getBaseName = (name: any) => {
		if (!name) return "";
		let base = name.toLowerCase();
		base = base.replace(/\d+/g, "");
		const words = Object.keys(numberWords).sort((a, b) => b.length - a.length);
		words.forEach((word) => {
			const regex = new RegExp(`\\b${word}\\b`, "g");
			base = base.replace(regex, "");
		});
		return base.replace(/\s+/g, " ").trim();
	};

	const getCustomOrderVal = (name: any) => {
		if (!name || !customOrder) return null;
		if (customOrder[name] !== undefined) return customOrder[name];
		const lowerName = name.toLowerCase();
		for (const [key, value] of Object.entries(customOrder)) {
			if (key.toLowerCase() === lowerName) return value;
		}
		return null;
	};

	const sortTree = (nodes: any) => {
		nodes.sort((a: any, b: any) => {
			const nameA = a.name || "";
			const nameB = b.name || "";
			const priorityA = getPriority(nameA);
			const priorityB = getPriority(nameB);
			if (priorityA !== priorityB) return priorityA - priorityB;

			const customA = getCustomOrderVal(nameA);
			const customB = getCustomOrderVal(nameB);
			if (customA !== null && customB !== null) return customA - customB;
			if (customA !== null) return -1;
			if (customB !== null) return 1;

			const orderA =
				a.order !== undefined && a.order !== null && a.order !== ""
					? parseInt(a.order, 10)
					: null;
			const orderB =
				b.order !== undefined && b.order !== null && b.order !== ""
					? parseInt(b.order, 10)
					: null;
			if (
				orderA !== null &&
				orderB !== null &&
				!isNaN(orderA) &&
				!isNaN(orderB)
			) {
				if (orderA !== orderB) return orderA - orderB;
			}
			if (orderA !== null && !isNaN(orderA)) return -1;
			if (orderB !== null && !isNaN(orderB)) return 1;

			const tagNumA =
				a.number !== undefined && a.number !== null && a.number !== ""
					? parseInt(a.number, 10)
					: null;
			const tagNumB =
				b.number !== undefined && b.number !== null && b.number !== ""
					? parseInt(b.number, 10)
					: null;
			if (
				tagNumA !== null &&
				tagNumB !== null &&
				!isNaN(tagNumA) &&
				!isNaN(tagNumB)
			) {
				if (tagNumA !== tagNumB) return tagNumA - tagNumB;
				const subNumA =
					a.subNumber !== undefined &&
					a.subNumber !== null &&
					a.subNumber !== ""
						? parseInt(a.subNumber, 10)
						: null;
				const subNumB =
					b.subNumber !== undefined &&
					b.subNumber !== null &&
					b.subNumber !== ""
						? parseInt(b.subNumber, 10)
						: null;
				if (
					subNumA !== null &&
					subNumB !== null &&
					!isNaN(subNumA) &&
					!isNaN(subNumB)
				) {
					if (subNumA !== subNumB) return subNumA - subNumB;
				}
				if (subNumA !== null && !isNaN(subNumA)) return -1;
				if (subNumB !== null && !isNaN(subNumB)) return 1;
			}
			if (tagNumA !== null && !isNaN(tagNumA)) return -1;
			if (tagNumB !== null && !isNaN(tagNumB)) return 1;

			const candA = extractNumber(nameA);
			const candB = extractNumber(nameB);

			if (candA && candB) {
				const numA = candA.value;
				const numB = candB.value;
				const baseA = getBaseName(nameA);
				const baseB = getBaseName(nameB);
				if (baseA === baseB) return numA - numB;

				if (candA.position <= 2 && candB.position <= 2) {
					if (numA !== numB) return numA - numB;
					if (nameA.length !== nameB.length) return nameA.length - nameB.length;
				}

				const baseCompare = baseA.localeCompare(baseB, undefined, {
					numeric: true,
					sensitivity: "base",
				});
				if (baseCompare !== 0) return baseCompare;
				return numA - numB;
			}
			if (candA) return -1;
			if (candB) return 1;

			return nameA.localeCompare(nameB, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
		nodes.forEach((node: any) => {
			if (node.children && node.children.length > 0) sortTree(node.children);
		});
	};

	sortTree(root.children);

	// Flatten the tree in depth-first order
	const flattened: any = [];
	const flatten = (nodes: any) => {
		nodes.forEach((node: any) => {
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
