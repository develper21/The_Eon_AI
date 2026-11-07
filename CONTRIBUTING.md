# Contributing

Thanks for helping improve Eon AI. This guide covers local setup, coding conventions, and the checks a
change is expected to pass. For security issues and secret handling, read [SECURITY.md](SECURITY.md)
first — never report a vulnerability or a leaked key in a public issue.

## Getting started

Requirements: Node.js and npm. The bundled local inference runtime ships binaries for macOS (Apple
Silicon and Intel) and Windows x64; Linux can run the app but not local inference.

```bash
git clone https://github.com/develper21/The_Eon_AI.git
cd The_Eon_AI
npm install
npm start
```

Other scripts:

```bash
npm run package   # Package the app with Electron Forge
npm run make      # Build platform installers
npm run lint      # Prints "No linting configured"
```

## Project layout

```
src/
├── index.js                 # Main process entry, storage and general IPC handlers
├── index.html               # Renderer shell and Content-Security-Policy
├── preload.js               # Currently empty (contextIsolation is off)
├── storage.js               # Config, credentials, preferences, history, rate limits
├── components/
│   ├── app/                 # Root application component
│   └── views/               # Screen-level components (Lit)
├── utils/
│   ├── window.js            # BrowserWindow creation, global shortcuts, window IPC
│   ├── gemini.js            # AI session handling and session IPC
│   ├── localai.js           # Local llama.cpp / whisper.cpp sessions
│   ├── native-ai-runtime.js # Verified runtime and model downloads
│   ├── renderer.js          # Renderer-side IPC helpers
│   └── prompts.js           # System prompts
└── assets/                  # Vendored libraries (Lit, marked, highlight.js) — do not hand-edit
```

## Style

Formatting is enforced with Prettier using `.prettierrc`: four-space indentation, `printWidth` 150,
semicolons, single quotes, ES5 trailing commas, and LF line endings.

```bash
npx prettier --write .
```

Run this before committing. `src/assets` and `node_modules` are excluded via `.prettierignore`. There
is no linter configured, so match the surrounding code and keep the diff focused.

## UI components

The interface is being rebuilt with shadcn/ui using Lit for the existing views.

- Place generated shadcn components under `src/components/ui` and export them from that folder.
- Add components with the CLI — `npx shadcn@latest add <component>` — rather than hand-rolling them.
- Follow the `React.forwardRef` plus `cn()` helper pattern where React is used.
- Import from `src` with the `@/` prefix.
- Style with the Tailwind CSS variables and utilities in `@/utils/tailwind`.

## Code standards

- Prefer TypeScript for new files, with strict mode and explicit interfaces. Avoid `any`.
- Write functional React components with hooks, wrapped in error boundaries where appropriate.
- Validate and sanitize every value crossing the renderer/main IPC boundary.
- Keep heavy audio and inference work off the UI thread; stream audio instead of buffering it whole.
- Handle device failures and missing permissions gracefully instead of crashing the app.
- Preserve the current Electron security settings unless the change is itself a security
  improvement; see the hardening backlog in [SECURITY.md](SECURITY.md).

## Secrets

Never commit API keys, tokens, `.env` files, or credentials. The app is BYOK: keys are entered at
runtime and stored locally by `src/storage.js`. Hardcoded keys, including "convenience" defaults in
`MainView.js` or anywhere else, are treated as a security incident.

Before pushing, confirm the scan is clean:

```bash
git grep -nE "(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})"
```

If you commit a key by accident, revoke it with the provider immediately, then follow
[SECURITY.md](SECURITY.md#if-a-key-is-leaked). Rotating the key matters more than removing the commit.

## Commits

Keep messages short and prefixed by type:

```
feat: add dual-stream microphone capture
fix: verify whisper model checksum before loading
docs: document credential storage limitations
refactor: split session IPC handlers out of gemini.js
```

One logical change per commit. Include a short body explaining why the change was needed when the
reason is not obvious from the diff.

## Pull requests

Before opening a pull request:

1. Run `npx prettier --write .` on the files you touched.
2. Run `npm run typecheck` if the change touches TypeScript.
3. Run `npm start` and confirm the app launches and the affected flow still works.
4. Run the secret scan above.
5. Note the platforms you tested. Local inference changes need a macOS or Windows check; if you could
   not test one, say so.

In the description, explain the problem, the approach, and anything you deliberately left out. Include
screenshots for UI changes. Keep unrelated refactors in separate pull requests.

## Tests

There is no automated test suite yet. Until one exists, the minimum bar for a change is that
`npm install` and `npm start` work and the touched flow behaves correctly by hand.

When the suite lands, every new feature should ship with tests, and `npm test` must pass before a
commit. High-value areas to cover first: audio capture and resampling, transcription, IPC validation,
and credential handling. Do not skip, weaken, or silence a failing test to land a change.

## Merging upstream changes

This repository is a fork of [cheating-daddy](https://github.com/sohzm/cheating-daddy), and upstream
work is commonly cherry-picked here.

1. Inspect the incoming diff and drop anything that conflicts with local branding or architecture.
2. Keep commit messages short and conventional (`feat:`, `fix:`, and so on).
3. After merging, run the app locally to confirm it still builds and functions.

## Questions and ideas

Open a regular issue for bug reports and feature proposals; include the version, platform, and steps to
reproduce. For anything that could affect the security of users, use the private channel described in
[SECURITY.md](SECURITY.md) instead.
