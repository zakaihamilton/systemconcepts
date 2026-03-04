## 2026-02-04 - Dynamic ARIA Labels in Lists
**Learning:** Icon-only buttons in lists (like "Delete") are ambiguous to screen readers if they all share the same static label.
**Action:** Always append the item's name/identifier to the action label (e.g., "Delete [Item Name]") to provide necessary context.

## 2026-02-04 - Dynamic ARIA Labels in Lists
**Learning:** Icon-only buttons in lists (like "Delete") are ambiguous to screen readers if they all share the same static label.
**Action:** Always append the item's name/identifier to the action label (e.g., "Delete [Item Name]") to provide necessary context.

## 2026-03-04 - ARIA Labels on Status Bars and Transcripts
**Learning:** Icon-only buttons in complex UI widgets (like StatusBars and Transcript views) need dynamic ARIA labels that describe their current state or function, such as "Previous Match (0:05)" or dynamic select/delete actions.
**Action:** When adding ARIA labels to interactive elements whose function or context changes, use dynamic variables or state values to provide accurate descriptions for screen readers.
