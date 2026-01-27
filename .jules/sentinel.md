## 2025-02-18 - Exposed Full User Object in Login API
**Vulnerability:** The `pages/api/login.js` endpoint was returning the entire user object from the database to the client. This object included sensitive internal fields such as `resetToken`, `resetTokenExpiry`, `_id`, and potentially `email` or other future sensitive fields.
**Learning:** The `login` utility function returns the raw MongoDB document for internal use, but the API endpoint was spreading this object directly into the JSON response without filtering.
**Prevention:** Always whitelist the specific fields intended for the client response in API endpoints. Do not rely on the internal data model being safe for public exposure.
