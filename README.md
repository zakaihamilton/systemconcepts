# System Concepts

System Concepts is a Next.js application for browsing, researching, playing, editing, and synchronizing a multilingual library of articles and recorded sessions. It is installable as a PWA and can continue serving cached content while offline.

## Requirements

- Node.js 24 (see `.nvmrc`)
- Yarn 1.x via Corepack

```bash
corepack enable
yarn install --frozen-lockfile
cp .env.example .env.local
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). The public shell and local/offline features do not require production credentials.

## Architecture

- `app/` contains the Next.js App Router entrypoints, API routes, and offline fallback.
- `src/components/` contains shared application and widget components.
- `src/views/` contains route-level product views.
- `src/storage/` contains concrete local, AWS, and Wasabi storage adapters.
- `src/sync/` contains manifest-based synchronization and migration orchestration.
- `src/util/` contains browser, API, domain, data, authentication, and storage utilities.
- `src/data/languages/` contains per-language copy and content metadata.
- `src/types/` contains shared TypeScript types.

Client navigation uses hash routes for compatibility with installed/offline deployments. Do not change route names, storage paths, or manifest shapes without a migration plan.

## Configuration

Copy `.env.example` to `.env.local` and fill only the services needed for the workflow you are testing.

| Variable | Purpose | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL`, `SITE_URL` | Absolute application URL and internal API verification | Production/RSS |
| `NEXT_PUBLIC_LOG_LEVEL`, `LOG_LEVEL` | Browser and server log thresholds | No |
| `MONGO_URL`, `MONGO_DB` | Accounts and MongoDB-backed personal data | Authentication/personal data |
| `AWS_ENDPOINT`, `AWS_BUCKET`, `AWS_ID`, `AWS_SECRET` | S3-compatible storage | AWS storage |
| `WASABI_URL` | Wasabi media/proxy URL | Wasabi storage |
| `RSS_MEDIA_SECRET` | Authorizes public RSS media and transcript links | Production RSS |
| `GMAIL_USER`, `GMAIL_PASSWORD`, `GMAIL_FROM` | Password-reset email | Email delivery |

Never commit real credentials. Logging redacts common credential and token fields, but secrets should still not be passed as diagnostic context.

## Storage and synchronization

The storage facade dispatches operations to enabled adapters while preserving device-prefixed paths such as `local/...`, `aws/...`, and `wasabi/...`. Synchronization compares local and remote manifests, downloads remote changes, uploads local changes, resolves supported conflicts, and persists manifests and caches locally.

AWS, Wasabi, MongoDB, and email integrations are optional in local development. Features backed by an unconfigured service will be unavailable, while public and cached local content can still run.

## PWA and offline behavior

The repo-owned `public/sw.js` provides the offline fallback and runtime caching rules; `/~offline` is the document fallback. Service workers register only in production, so use a production build to test offline behavior.

```bash
yarn build
yarn start
```

To inspect production webpack bundle sizes, run `yarn analyze`. Reports are written to `.next/analyze/` (`client.html`, `nodejs.html`, and `edge.html`) without opening a browser.

## Verification

Linting uses Biome (`biome check .`). Type checking uses `tsc --noEmit`.

```bash
yarn lint
yarn typecheck
yarn test --runInBand
yarn test:coverage
yarn build
yarn test:e2e
```

`yarn verify` runs the complete sequence. Jest enforces a global coverage gate of **80%** for statements, branches, functions, and lines. Playwright tests use intercepted requests and seeded browser state; they must not depend on production databases, storage accounts, email, or user credentials.

`yarn audit:dependencies` fails on high-severity dependency advisories. Before deploying a MongoDB-backed environment, run `yarn db:indexes` with `MONGO_URL` and `MONGO_DB` configured. It is idempotent and provisions the user/session/challenge/rate-limit uniqueness and expiry indexes.

The production CSP allows only the configured site and storage origins. Set `AWS_ENDPOINT` and `WASABI_URL` to their real origins before deploying; broad third-party browser connections are intentionally not allowed.

## Deployment

Deploy the production build to a Node-compatible platform such as Vercel. Configure only the environment variables required by enabled services. CI uses Node from `.nvmrc`, installs from `yarn.lock`, and runs lint, dependency audit, type checking, Jest (including the coverage gate), the production build, and deterministic Chromium smoke tests.
