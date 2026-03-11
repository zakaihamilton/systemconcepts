## 2026-03-11 - Adding ARIA Labels to Tooltip-wrapped IconButtons
**Learning:** Icon buttons that rely purely on iconography often lack native `aria-label` attributes even when wrapped in a `Tooltip` component, affecting screen reader accessibility. Tooltips usually provide visual context, but adding explicit `aria-label` attributes directly on the `IconButton` ensures robust screen reader support.
**Action:** When creating or modifying an `IconButton` that contains only an icon, ensure an explicit `aria-label` is provided on the button itself, often matching the tooltip content.
