## 2024-05-22 - [Enhancing Wrapper Components for Accessibility]
**Learning:** Wrapper components like `HoverButton` that encapsulate UI library components (like `Fab`) often swallow accessibility props like `aria-label` if they don't explicitly spread `...props` to the underlying element. This creates hidden accessibility traps where developers *think* they're adding labels, but they don't render.
**Action:** When creating or auditing wrapper components, always ensure `...rest` or `...props` are spread to the main interactive child element to support standard HTML attributes and ARIA roles.
