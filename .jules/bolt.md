## 2026-02-16 - Lazy Evaluation in TableWidget
**Learning:** The TableWidget was eagerly computing `searchableText` for every row, even when no search was active. This caused significant overhead for large datasets during initial render.
**Action:** Use lazy getters (`get searchableText() { ... }`) combined with `Object.defineProperty` (for memoization) to defer expensive string processing until the property is actually accessed (e.g. during search).
