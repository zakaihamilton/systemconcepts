## 2025-02-23 - Table Widget Optimization
**Learning:** `React.useMemo` is powerful, but nested loops inside it can still be expensive if they allocate arrays for every item. Specifically, `filter` and `map` inside a loop over a large dataset (like table rows) is an O(N*M) operation with O(N*M) allocations. Moving invariant calculations (like determining which columns to search) outside the loop reduced allocations from N to 1.
**Action:** Always inspect `filter` or `map` callbacks in `useMemo` for invariant calculations that can be hoisted.
