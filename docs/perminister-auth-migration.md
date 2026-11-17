# Perminister authentication

System Concepts uses Perminister for password sign-in while keeping each app user ID, profile, role, and app data in its existing MongoDB records. The login accepts the email address or the user's System Concepts ID. Only an existing System Concepts user record can sign in; new users must be provisioned locally before their Perminister account is linked, and deleting a local user keeps app access disabled. Local password registration, reset, and change endpoints are disabled after cutover. System Concepts does not provide local passkey registration, authentication, or management; future passkey support will be handled by Perminister.

## Configuration

Create a Perminister consumer client for product ID `systemconcepts` and the exact System Concepts production origin. Copy its client ID and secret into server-only environment values. Set `PERMINISTER_AUTH_ENABLED=true` and build with `NEXT_PUBLIC_PERMINISTER_LOGIN_ENABLED=true` to switch the UI and stop accepting local password sessions. Use `SITE_URL` as the canonical production origin so the OIDC callback matches the registered client origin.

## Password migration

`pnpm migration:export-auth -- --output <new-encrypted-file>` reads only user IDs, email, names, and bcrypt verifiers from MongoDB. It writes an AES-256-GCM encrypted file with mode `0600`. On a trusted machine, Perminister's importer performs a dry run by default; pass `--apply` only after resolving every conflict. Existing Perminister subjects matched by normalized email keep their current password verifier and receive the System Concepts ID as a product login identifier. Other imported verifiers are checked as bcrypt and rehashed to Perminister's current scrypt format after a successful login.

System Concepts roles are not included in the export and continue to be read from MongoDB. Perminister's normal email-verification policy remains in effect for imported email addresses.
