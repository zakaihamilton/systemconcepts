## 2025-02-18 - Search Index Keys Memoization
**Learning:** `Object.keys(largeObject)` is expensive (O(N)) and creates a new array. Calling it repeatedly inside a nested loop (e.g. for every search token) significantly degrades performance.
**Action:** Memoize large object key extractions outside of hot loops using `useMemo` or variable hoisting, especially in search or filtering logic.
