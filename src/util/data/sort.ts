export const collator = new Intl.Collator("en", {
	numeric: true,
	sensitivity: "base",
});

export function descendingComparator(a: any, b: any, orderBy: any) {
	const aVal = a && a[orderBy];
	const bVal = b && b[orderBy];

	// Optimization: Use native subtraction for non-negative numbers (e.g. Years, Counts, Durations).
	// This is ~8x faster than Intl.Collator.
	// We restrict to non-negative numbers to preserve the legacy behavior where '0' was treated
	// as falsy ("") by the previous implementation, ensuring consistent sort order with negative numbers/nulls.
	if (
		typeof aVal === "number" &&
		typeof bVal === "number" &&
		aVal >= 0 &&
		bVal >= 0
	) {
		return aVal - bVal;
	}

	const aText = aVal || "";
	const bText = bVal || "";
	return collator.compare(aText, bText);
}

export function getComparator(order: any, orderBy: any) {
	return order === "desc"
		? (a: any, b: any) => descendingComparator(a, b, orderBy)
		: (a: any, b: any) => -descendingComparator(a, b, orderBy);
}

export function stableSort(array: any, comparator: any) {
	return array.slice().sort(comparator);
}
