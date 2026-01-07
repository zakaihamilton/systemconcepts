## 2025-02-23 - Tooltip vs Aria-Label on IconButtons
**Learning:** `Tooltip` provides a visual label on hover but does not always guarantee a sufficient accessible name for screen readers on interactive elements like `IconButton`, especially if `title` is used as `aria-label` by the library but behavior is inconsistent or if explicit `aria-label` is preferred for direct access.
**Action:** Always add explicit `aria-label` to icon-only buttons, even when using `Tooltip`.
