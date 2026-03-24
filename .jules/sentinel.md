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

## 2026-03-17 - Fix Path Traversal in Wasabi API / Player
**Vulnerability:** Path traversal existed in `pages/api/player.js` and `src/util/wasabi.js` where user input `path` was passed to Wasabi S3 commands without proper validation against traversal sequences like `..` or restricted areas like `private/`.
**Learning:** Even though AWS functionality had traversal protection via `validatePathAccess`, parallel implementations for alternative storage providers (like Wasabi in this case) might inadvertently miss applying the exact same shared security utilities.
**Prevention:** Always ensure that common access validation routines (`validatePathAccess`) are extracted, generalized, and systematically applied across all storage adapters or route handlers that construct paths from user input.
## 2026-03-24 - [Path Traversal in RSS Proxy]
**Vulnerability:** The `app/api/rss/s/route.js` proxy endpoint did not validate the base64-encoded file path provided in the URL parameter. Because the endpoint does not authenticate users (by design, to support podcast clients), an attacker could provide paths containing directory traversal characters (`../`) or access restricted folders (`private/`) to obtain presigned AWS S3 URLs for any file in the bucket.
**Learning:** Unauthenticated file proxy endpoints that dynamically generate paths based on user input are extremely vulnerable to Path Traversal and Arbitrary File Access if the inputs are not strictly validated against a defined set of security rules.
**Prevention:** Always sanitize and validate file paths, even those received via encoded parameters, using a robust central validator like `validatePathAccess` from `@util/aws` before generating presigned URLs or retrieving files from the storage backend.
