## 2025-02-14 - Double Decoding Vulnerability in AWS API
**Vulnerability:** The `pages/api/aws.js` endpoint was decoding the path parameter from `req.headers` before passing it to `login`, but `handleRequest` (in `src/util/aws.js`) was also decoding it from `req.headers`. This double decoding could potentially allow path traversal bypasses if an attacker uses double-encoded sequences (e.g. `%252e%252e` -> `%2e%2e` -> `..`).
**Learning:** Decoding input too early can be dangerous. Security checks that rely on string matching (like `..`) must operate on the final, canonical form of the data that will be used by the system. If one layer decodes, and another layer decodes again, the first layer's checks (or assumptions) might be invalid for the second layer.
**Prevention:**
1. Decode inputs only once, as close to the usage as possible.
2. If multiple layers need the data, pass the decoded/sanitized version, not the raw one.
3. Ensure that security checks (like path traversal detection) are performed on the *exact* string that will be passed to the filesystem or API.
