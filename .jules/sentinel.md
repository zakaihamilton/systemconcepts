## 2025-02-18 - Exposed Full User Object in Login API
**Vulnerability:** The `pages/api/login.js` endpoint was returning the entire user object from the database to the client. This object included sensitive internal fields such as `resetToken`, `resetTokenExpiry`, `_id`, and potentially `email` or other future sensitive fields.
**Learning:** The `login` utility function returns the raw MongoDB document for internal use, but the API endpoint was spreading this object directly into the JSON response without filtering.
**Prevention:** Always whitelist the specific fields intended for the client response in API endpoints. Do not rely on the internal data model being safe for public exposure.

## 2025-02-19 - Mass Assignment in AWS Batch Upload
**Vulnerability:** The `pages/api/aws.js` endpoint allowed batch PUT requests (uploading multiple files) but only validated access permissions against the *first* file's path. An attacker could bundle an authorized file with unauthorized files (e.g., overwriting system files) to bypass access controls.
**Learning:** When handling batch operations, it is critical to validate *every* item in the collection, not just the container or the first element. The assumption that `req.body` structure mirrors the single-item validation logic led to this gap.
**Prevention:** Implement iteration loops that validate security constraints for each individual item in a batch request before processing.

## 2025-02-19 - Insecure Direct DB Replacement in API Handlers
**Vulnerability:** The `handleRequest` utility allows batch updates via `replaceOne`, which completely overwrites documents. In `pages/api/users.js`, this was exposed to Admins, allowing accidental data loss (role, salt, etc.) and plaintext password storage because the API relied on frontend-provided objects without merging or hashing in the batch path. Additionally, the single-user path failed to hash passwords for new users.
**Learning:** Generic CRUD handlers like `handleRequest` must be used with extreme caution when sensitive logic (hashing, field protection) is required. They often bypass application-level constraints.
**Prevention:** Explicitly intercept and process batch requests in the API layer before delegating to generic handlers, ensuring all security invariants (hashing, merging) are applied to every item.
