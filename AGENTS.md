# AGENTS.md

## Cursor Cloud specific instructions

System Concepts is a single Next.js 16 (App Router) app — a multilingual, offline-first PWA. There is one service: the Next.js server. See `README.md` for the full command list and `.env.example` for configuration.

### Node version gotcha (important)
The repo requires Node 24 (`.nvmrc`), installed via `nvm`. The sandbox ships a Node 22 binary at `/exec-daemon/node` that takes precedence on `PATH` in **non-login** shells, so a bare `node`/`yarn` may silently run Node 22.
- Interactive/login shells are already fixed (`~/.bashrc` prepends the Node 24 nvm bin), and tmux sessions started with a login shell (`-l`) get Node 24.
- For non-login one-off commands (e.g. the default Shell tool), wrap commands as `bash -lc '<cmd>'`, or run `nvm use 24` first, to guarantee Node 24.

### Running / lint / test / build
Standard scripts live in `package.json` (`dev`, `lint`, `typecheck`, `test`, `build`, `start`, `test:e2e`). Run them under Node 24 (see above), e.g. `bash -lc 'yarn dev'`. `yarn dev` serves on `http://localhost:3000`.

### Local-only development
The app runs fully locally with no external services. MongoDB, AWS/Wasabi storage, and email are all optional — features backed by an unconfigured service are simply unavailable, while the public UI plus local/offline features (settings, language, theme, tags, groups, storage) work. Copy `.env.example` to `.env.local` (all values optional for local dev).

### Service workers / offline
Service workers register only in a production build (`yarn build && yarn start`), not in `yarn dev`. Test offline/PWA behavior against a production build.

### E2E tests
Playwright (`yarn test:e2e`) needs a Chromium install first: `npx playwright install --with-deps chromium` (heavy, not part of the startup update script). It builds and serves a production server on port `3107` itself.
