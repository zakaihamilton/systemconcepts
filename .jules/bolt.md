## 2024-02-23 - Native Sort & Hoisting Performance
**Learning:** Modern JS engines (Node 18+, V8) have stable `Array.prototype.sort`. Manual implementation of stable sort (map-sort-map) is slower and allocates more memory.
**Action:** Replace custom `stableSort` implementations with native `sort` whenever possible.
**Learning:** `search.toLowerCase()` inside a filter loop is a common anti-pattern that can be easily overlooked.
**Action:** Always check loop invariants and hoist them out.
