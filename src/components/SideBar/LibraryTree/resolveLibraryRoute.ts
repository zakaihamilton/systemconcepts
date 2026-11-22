import { LibraryTagKeys } from "@views/Library/Icons";

export interface ResolvedLibraryRoute {
	tag: any | null;
	paragraphId: number | null;
	urlPath: string;
	parentIds: string[];
}

export function getTagHierarchy(tag: any): string[] {
	const hierarchy = LibraryTagKeys.map((key) => tag[key])
		.map((v) => (v ? String(v).trim() : null))
		.filter(Boolean) as string[];
	if (tag.number && hierarchy.length > 0) {
		hierarchy[hierarchy.length - 1] =
			`${hierarchy[hierarchy.length - 1]}:${tag.number}`;
	}
	return hierarchy;
}

/**
 * Resolves a library route path into the matching tag, optional paragraph anchor,
 * normalized hierarchy path, and ancestor node IDs to expand in the sidebar.
 */
export function resolveLibraryRoute(
	tags: any[],
	pathItems: string[],
): ResolvedLibraryRoute | null {
	if (
		tags.length === 0 ||
		pathItems.length <= 1 ||
		pathItems[0] !== "library"
	) {
		return null;
	}

	let tag: any = null;
	let paragraphId: number | null = null;
	let urlPath = pathItems.slice(1).join("|");

	if (pathItems[1] === "id") {
		const idPart = pathItems[2];
		if (idPart) {
			const colonIndex = idPart.lastIndexOf(":");
			const id = colonIndex !== -1 ? idPart.substring(0, colonIndex) : idPart;
			const possibleParagraph =
				colonIndex !== -1 ? idPart.substring(colonIndex + 1) : null;
			if (possibleParagraph && !isNaN(parseInt(possibleParagraph, 10))) {
				paragraphId = parseInt(possibleParagraph, 10);
			}
			tag = tags.find((t) => String(t._id) === String(id)) || null;
			if (tag) {
				urlPath = getTagHierarchy(tag).join("|");
			}
		}
	} else {
		tag = tags.find((t) => getTagHierarchy(t).join("|") === urlPath) || null;

		if (!tag) {
			const parts = urlPath.split("|");
			const lastPart = parts[parts.length - 1];
			const lastSepIndex = lastPart.lastIndexOf(":");
			if (lastSepIndex !== -1) {
				const possibleParagraph = lastPart.slice(lastSepIndex + 1);
				if (!isNaN(parseInt(possibleParagraph, 10))) {
					paragraphId = parseInt(possibleParagraph, 10);
					tag =
						tags.find((t) => {
							const h = getTagHierarchy(t);
							const hStr = h.join("|");
							const urlLastSep = urlPath.lastIndexOf(":");
							const urlBase =
								urlLastSep !== -1 ? urlPath.substring(0, urlLastSep) : urlPath;

							if (hStr === urlPath) return true;
							if (hStr === urlBase) return true;

							const tagLastSep = hStr.lastIndexOf(":");
							if (tagLastSep !== -1) {
								const tagBase = hStr.substring(0, tagLastSep);
								if (tagBase === urlBase) return true;
							}
							return false;
						}) || null;
				}
			}
		}
	}

	if (!tag) {
		return { tag: null, paragraphId, urlPath, parentIds: [] };
	}

	const hierarchy = getTagHierarchy(tag);
	const parentIds: string[] = [];
	let currentPath = "";
	hierarchy.forEach((segment, index) => {
		if (!segment) return;
		currentPath = currentPath ? `${currentPath}|${segment}` : segment;
		if (index < hierarchy.length - 1) {
			parentIds.push(currentPath);
		}
	});

	return { tag, paragraphId, urlPath, parentIds };
}
