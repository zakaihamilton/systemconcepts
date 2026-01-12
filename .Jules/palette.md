## 2024-05-22 - [Keyboard Accessibility in Virtualized Lists]
**Learning:** Virtualized lists (`react-window`) render container `div`s that block standard semantic HTML flow. Custom item renderers need explicit `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers to match native button behavior, especially when `onClick` is provided but no anchor tag is used.
**Action:** When creating custom interactive list items, always verify keyboard navigability (Tab to focus, Enter/Space to activate) and ensure screen readers announce them as interactive elements.

## 2024-05-22 - [MUI Link Component Flexibility]
**Learning:** The MUI `Link` component defaults to rendering an `<a>` tag. If `href` is missing but `onClick` is present, it renders an inaccessible `<a>` (no `href`). Explicitly setting `component="button"` fixes this by rendering a native button, providing focus and keyboard support automatically.
**Action:** Use `component={!href && onClick ? "button" : undefined}` on MUI `Link` components that might act as buttons.
