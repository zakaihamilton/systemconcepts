export const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function descendingComparator(a, b, orderBy) {
    const aText = a && a[orderBy] || "";
    const bText = b && b[orderBy] || "";
    return collator.compare(aText, bText);
}

export function getComparator(order, orderBy) {
    return order === "desc"
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}

export function stableSort(array, comparator) {
    return array.slice().sort(comparator);
}
