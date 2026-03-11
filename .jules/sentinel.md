## 2025-02-18 - Exposed Full User Object in Login API
**Vulnerability:** The `pages/api/login.js` endpoint was returning the entire user object from the database to the client. This object included sensitive internal fields such as `resetToken`, `resetTokenExpiry`, `_id`, and potentially `email` or other future sensitive fields.
**Learning:** The `login` utility function returns the raw MongoDB document for internal use, but the API endpoint was spreading this object directly into the JSON response without filtering.
**Prevention:** Always whitelist the specific fields intended for the client response in API endpoints. Do not rely on the internal data model being safe for public exposure.

## 2025-02-19 - Mass Assignment in AWS Batch Upload
**Vulnerability:** The `pages/api/aws.js` endpoint allowed batch PUT requests (uploading multiple files) but only validated access permissions against the *first* file's path. An attacker could bundle an authorized file with unauthorized files (e.g., overwriting system files) to bypass access controls.
**Learning:** When handling batch operations, it is critical to validate *every* item in the collection, not just the container or the first element. The assumption that `req.body` structure mirrors the single-item validation logic led to this gap.
**Prevention:** Implement iteration loops that validate security constraints for each individual item in a batch request before processing.

## 2024-05-28 - Missing Path Traversal Validation in Subtitle Download API
**Vulnerability:** A Path Traversal vulnerability in `pages/api/subtitle.js` where user input for `path` was passed to S3 bucket / filesystem functions (`downloadData`) without proper directory restriction checks, unlike other APIs like `summary.js`.
**Learning:** Even though core storage adapters (`@util/aws.js`) often perform checks during direct file manipulations (like PUT/DELETE), simple read methods (`downloadData`) might omit strict path-level sanitization because they assume the parent endpoint validates the path boundaries first. When implementing isolated download endpoints, this path validation gets missed.
**Prevention:** Always implement an explicit perimeter validation step (`validatePathAccess()`) at the endpoint boundary *before* calling internal adapters, rather than relying on the storage abstraction to validate logic, to ensure consistent and robust access control across all entry points.
