## 2025-04-08 - Accessible IconButton Labels in Transcript Search
**Learning:** Icon-only buttons used for sub-components (like Transcript search pagination) without explicit `aria-label`s are a common accessibility gap, even if they're wrapped in Tooltips. Next.js/Material UI don't derive accessible names from Tooltips for screen readers natively on the button.
**Action:** Always map the name/tooltip title or explicit translations directly to the `aria-label` attribute on the `IconButton` itself when no visible text is present.
