# Perminister authentication and roles

System Concepts uses Perminister for sign-in and product role assignments. User IDs, profiles, and application data stay in MongoDB; the app reads its active role from Perminister. The login accepts the email address or the user's System Concepts ID. Only an existing System Concepts user record can sign in; new users must be provisioned locally before their Perminister account is linked, and deleting a local user keeps app access disabled. Local password registration, reset, and change endpoints are disabled after cutover. System Concepts does not provide local passkey registration, authentication, or management; future passkey support will be handled by Perminister.

System Concepts publishes its role catalog at `/api/perminister/role-catalog`. Perminister reads that endpoint from the product's registered HTTPS website. An administrator stages and reviews the catalog before applying it. Catalog roles are product-scoped and use the existing `visitor`, `student`, `upper`, `teacher`, and `admin` hierarchy. The app uses the highest valid System Concepts product role assigned in the configured Perminister organization. Organization or platform administrator status does not replace the product role.

## Configuration

Create a Perminister consumer client for product ID `systemconcepts` and the exact System Concepts production origin. Copy its client ID and secret into server-only environment values. Set `PERMINISTER_ORGANIZATION_ID` to the UUID of the organization whose System Concepts grants the app should use. Set `PERMINISTER_AUTH_ENABLED=true` and build with `NEXT_PUBLIC_PERMINISTER_LOGIN_ENABLED=true` to switch the UI and stop accepting local password sessions. Use `SITE_URL` as the canonical production origin so the OIDC callback matches the registered client origin.

Before enabling the cutover, add the product to the Perminister organization, fetch and review the catalog, and apply the roles. Existing verified Perminister accounts can be added directly as product members with the intended role; this sends no invitation and does not require invitation acceptance. The product keeps the existing System Concepts user record and ID as its account link. A person without a Perminister role assignment cannot sign in to System Concepts after cutover. Until `PERMINISTER_ORGANIZATION_ID` is set, sign-in continues to use each existing local role; once it is set, the app requires the matching System Concepts product role. Local role changes are disabled while Perminister login is enabled.

Visitors retain the `visitor` role. The existing `roleAuth(..., "student")` checks continue to block them from Sessions.

## Password migration

`pnpm migration:export-auth -- --output <new-encrypted-file>` reads only user IDs, email, names, and bcrypt verifiers from MongoDB. It writes an AES-256-GCM encrypted file with mode `0600`. On a trusted machine, Perminister's importer performs a dry run by default; pass `--apply` only after resolving every conflict. Existing Perminister subjects matched by normalized email keep their current password verifier and receive the System Concepts ID as a product login identifier. Other imported verifiers are checked as bcrypt and rehashed to Perminister's current scrypt format after a successful login.

The encrypted identity export intentionally does not assign roles. Review and assign roles in Perminister before cutover. Perminister's normal email-verification policy remains in effect for imported email addresses.
