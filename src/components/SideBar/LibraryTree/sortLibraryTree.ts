import { wordToNumber as numberWords } from "@util/data/numberWords";

export type SortableLibraryNode = {
	id: string;
	name: string;
	type?: string;
	children: SortableLibraryNode[];
	[key: string]: any;
};

function getPriority(name: string): number {
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
	) {
		return 5;
	}
	return 999;
}

function extractNumber(name: string) {
	if (!name) return null;
	const lowerName = name.toLowerCase();
	const candidates: { position: number; value: number }[] = [];
	const digitRegex = /(\d+)/g;
	let digitMatch: RegExpExecArray | null;
	while ((digitMatch = digitRegex.exec(name)) !== null) {
		candidates.push({
			position: digitMatch.index,
			value: parseInt(digitMatch[1], 10),
		});
	}
	const wordRegex = /[a-z]+/gi;
	let wordMatch: RegExpExecArray | null;
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
}

function getBaseName(name: string): string {
	if (!name) return "";
	let base = name.toLowerCase();
	base = base.replace(/\d+/g, "");
	const words = Object.keys(numberWords).sort((a, b) => b.length - a.length);
	words.forEach((word) => {
		const regex = new RegExp(`\\b${word}\\b`, "g");
		base = base.replace(regex, "");
	});
	return base.replace(/\s+/g, " ").trim();
}

function getCustomOrderVal(
	name: string,
	customOrder: Record<string, any> | undefined,
): number | null {
	if (!name || !customOrder) return null;
	if (customOrder[name] !== undefined) return customOrder[name];
	const lowerName = name.toLowerCase();
	for (const [key, value] of Object.entries(customOrder)) {
		if (key.toLowerCase() === lowerName) return value;
	}
	return null;
}

function parseOptionalInt(value: any): number | null {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	const parsed = parseInt(value, 10);
	return isNaN(parsed) ? null : parsed;
}

/**
 * Recursively sorts a hierarchy of library tree nodes by editorial priority,
 * custom order, explicit order/number fields, embedded numbers, and locale order.
 */
export function sortLibraryTree<T extends SortableLibraryNode>(
	nodes: T[],
	customOrder: Record<string, any> = {},
): T[] {
	nodes.sort((a, b) => {
		const nameA = a.name || "";
		const nameB = b.name || "";
		const priorityA = getPriority(nameA);
		const priorityB = getPriority(nameB);
		if (priorityA !== priorityB) return priorityA - priorityB;

		const customA = getCustomOrderVal(nameA, customOrder);
		const customB = getCustomOrderVal(nameB, customOrder);
		if (customA !== null && customB !== null) return customA - customB;
		if (customA !== null) return -1;
		if (customB !== null) return 1;

		const orderA = parseOptionalInt(a.order);
		const orderB = parseOptionalInt(b.order);
		if (orderA !== null && orderB !== null && orderA !== orderB) {
			return orderA - orderB;
		}
		if (orderA !== null) return -1;
		if (orderB !== null) return 1;

		const tagNumA = parseOptionalInt(a.number);
		const tagNumB = parseOptionalInt(b.number);
		if (tagNumA !== null && tagNumB !== null) {
			if (tagNumA !== tagNumB) return tagNumA - tagNumB;
			const subNumA = parseOptionalInt(a.subNumber);
			const subNumB = parseOptionalInt(b.subNumber);
			if (subNumA !== null && subNumB !== null && subNumA !== subNumB) {
				return subNumA - subNumB;
			}
			if (subNumA !== null) return -1;
			if (subNumB !== null) return 1;
		}
		if (tagNumA !== null) return -1;
		if (tagNumB !== null) return 1;

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

	for (const node of nodes) {
		if (node.children && node.children.length > 0) {
			sortLibraryTree(node.children, customOrder);
		}
	}

	return nodes;
}
