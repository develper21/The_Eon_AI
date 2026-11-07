# Security Policy

This document describes how security issues are reported, how secrets are handled, and the known
security strengths and weaknesses of Eon AI. It applies to the Electron desktop app in this
repository.

## Supported versions

Security fixes are made on the default branch and shipped in the next release. Older releases are not
maintained.

| Version | Supported |
| ------- | --------- |
| 0.8.x   | Yes       |
| < 0.8   | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

- Preferred: open a private report through the repository's **Security → Report a vulnerability**
  tab (GitHub Security Advisories). This keeps the details private until a fix is available.
- Include the affected version, operating system, reproduction steps, and impact.
- Expect an acknowledgement within 5 business days. Please allow time for a fix before public
  disclosure.

Reports about leaked credentials should follow [Secret handling](#secret-handling) instead, since the
credential must be revoked first.

## Secret handling

Eon AI is a bring-your-own-key (BYOK) application. API keys belong to the person running the app and
must never enter the repository.

### Rules

1. **No keys in source, tests, fixtures, screenshots, or docs.** This includes `MainView.js`, sample
   configs, and anything under `src/`.
2. **No `.env` files committed.** `.env`, `.env.*`, `.dev.vars`, `credentials.json`, and key material
   (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`) are ignored by `.gitignore`. Only
   `.env.example` may be committed, and it must contain placeholder values.
3. **Keys are entered by the user at runtime** in the app's settings UI. The renderer sends them to the
   main process over IPC, and the main process stores them locally. They are never bundled, logged, or
   sent anywhere except the provider they belong to.
4. **No default or demo keys.** Never commit a working key "for convenience" or to make onboarding
   easier. A prefilled key field is a leak, not a feature.
5. **Redact when debugging.** When attaching logs to an issue, remove keys, tokens, resume text, and
   transcript content. Session logs under the config directory contain conversation content.

### If a key is leaked

Revoking the key is the only real fix; deleting the commit is not enough. Never paste the leaked
value into a document, issue, or commit while remediating it — that creates a new leak.

1. **Revoke and rotate immediately** in the provider console (for Google keys: Google AI Studio →
   API keys, and check the Google Cloud project for unexpected usage and billing). Revocation works
   even if the leak stays in git history.
2. Remove the key from the current tree and confirm with the scans in
   [Verifying that no secrets are present](#verifying-that-no-secrets-are-present).
3. Purge the value from git history (see below) if the repository is public, then dismiss the
   corresponding code scanning alert as **revoked**.
4. Review the provider's usage logs for abuse between the leak and the revocation.

### Verifying that no secrets are present

Run these before pushing a branch and before a release:

```bash
# Tracked files only
git grep -nE "(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{20,}|xoxb-|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})"

# Full history (slow on large repositories)
git log --all -p -S'AIzaSy' -- . | grep -n 'AIzaSy'
```

An empty result from both commands is the expected state.

### Purging a secret from history

History rewriting is destructive and requires a force push, so it is a maintainer action performed
with explicit authorization. Prefer revoking the key first, then purge so the alert can be closed.

```bash
# 1. Work on a mirror clone
git clone --mirror https://github.com/develper21/The_Eon_AI.git eon-purge.git
cd eon-purge.git

# 2. Replace the literal value everywhere in history.
#    Take the exact string from the alert, never from this document, and delete the
#    file afterwards so the key is not reintroduced by a later commit.
printf '%s==>REDACTED\n' '<leaked-key-from-alert-2>' > replacements.txt
printf '%s==>REDACTED\n' '<leaked-key-from-alert-1>' >> replacements.txt
git filter-repo --replace-text replacements.txt
rm -f replacements.txt

# 3. Force push the rewritten history (authorized maintainers only)
git push --force --all
git push --force --tags
```

Afterwards every collaborator must re-clone, and cached views on the hosting platform may need to be
cleared by platform support before the leaked value stops being served.

## Current security posture

The items below describe how the app behaves today. They are documented so contributors do not
mistake a known gap for a guarantee.

### Credential storage

- API keys are written in plaintext to `credentials.json` in the per-user config directory
  (`src/storage.js`): `~/Library/Application Support/cheating-daddy-config` on macOS,
  `%APPDATA%\cheating-daddy-config` on Windows, `~/.config/cheating-daddy-config` on Linux.
- The file relies on operating-system file permissions. There is no OS keychain (Keychain, Credential
  Manager, libsecret) integration and no encryption at rest.
- Consequence: any process or person with read access to the user's home directory can read the keys.
  Use a dedicated key with a spending limit, and clear data from the app when a machine is shared.

### Electron process isolation

- The renderer window is created with `nodeIntegration: true` and `contextIsolation: false`
  (`src/utils/window.js`), and `src/preload.js` is empty. This is an acknowledged TODO in the code.
- Consequence: any script execution in the renderer runs with Node.js privileges. The app mitigates
  this by loading only local files, using `webSecurity: true`,
  `allowRunningInsecureContent: false`, and a restrictive Content-Security-Policy in
  `src/index.html`.
- The CSP is `script-src 'self' 'unsafe-inline'`, so `'unsafe-inline'` remains a weakening factor.
- Packaged builds enable Electron fuses (`forge.config.js`): `RunAsNode` disabled, cookie encryption
  enabled, `NODE_OPTIONS` and `--inspect` disabled, ASAR integrity validation on, and the app can only
  load from ASAR.

### IPC surface

- The renderer can invoke a broad set of handlers: storage, session control, audio/image submission,
  PDF parsing, and window management. Handlers are grouped in `src/index.js`,
  `src/utils/window.js`, and `src/utils/gemini.js`.
- Window-scoped handlers validate the sender (`event.sender !== mainWindow.webContents`); storage and
  session handlers generally do not validate or sanitize their arguments beyond basic presence
  checks.
- Because the renderer is fully privileged, IPC validation currently defends against bugs, not
  against a compromised renderer. Tightening `contextIsolation` is the prerequisite for meaningful
  IPC trust boundaries.
- `open-external` calls `shell.openExternal` with the URL supplied by the renderer and does not
  restrict the scheme to `https:`. See [Hardening backlog](#hardening-backlog).

### Screen and audio capture

- The app captures screen content and, optionally, microphone and system audio. `setContentProtection`
  is enabled and the window is hidden from the taskbar and Mission Control, but content protection is
  best-effort and does not prevent other capture tools.
- Session context (screenshots, transcripts, answers) is sent to the provider selected by the user, or
  stays on the machine in local mode. There is no bundled telemetry.
- History, transport logs, and extracted resume text are stored on disk under the config directory
  and are deleted only when the user deletes them from the app or clears its data.
- Users are responsible for complying with recording and consent laws in their jurisdiction. Do not
  use the app to record people who have not consented.

### Local models and runtime downloads

- `src/utils/native-ai-runtime.js` pins a SHA-256 digest for every downloaded runner and model and
  verifies it after download, rejecting mismatches. Keep these digests updated only with values you
  can independently verify.
- Downloads come from external hosts (GitHub releases and Hugging Face). A missing digest must fail
  closed, never skip verification.

### Resume import

- PDF text extraction is capped at 100 pages and 20,000 characters, and parser resources are released
  in a `finally` block. Extracted text becomes part of the prompt and may be transmitted to the
  selected provider, so handle it as sensitive data.

### Dependency and release hygiene

- Windows and macOS builds are not code-signed or notarized (see the commented block in
  `forge.config.js`). Users therefore cannot verify binary provenance, and OS warnings should be
  expected. Treat signatures as a release blocker for any distribution beyond development.
- Run `npm audit` and keep Electron and `@google/genai` current; Electron majors carry security
  fixes.

## Hardening backlog

These are known gaps, tracked here rather than as guarantees:

1. Move to `contextIsolation: true` with a real `preload.js` and a narrow `contextBridge` API, and
   disable `nodeIntegration`.
2. Store credentials in the OS keychain instead of plaintext JSON, or encrypt them at rest.
3. Restrict `open-external` to `https:` URLs and validate every IPC argument shape in the main
   process.
4. Remove `'unsafe-inline'` from the CSP by moving inline styles into stylesheets or nonce-based
   policies.
5. Sign and notarize release builds.
6. Add automated secret scanning in CI (for example `gitleaks`) and enable provider-side push
   protection.
7. Add a test suite covering IPC validation and credential handling.

## Privacy summary

| Data                     | Location                             | Sent to                                    |
| ------------------------ | ------------------------------------ | ------------------------------------------ |
| API keys                 | Local `credentials.json` (plaintext) | The provider that owns the key             |
| Screen frames, audio     | Memory, then provider request        | Selected provider, or local runtime only   |
| Conversation and history | Local config directory `history/`    | Selected provider, or local runtime only   |
| Transport logs           | Local config directory `logs/`       | Nothing — local debugging aid              |
| Resume text              | Local config, included in prompts    | Selected provider, or local runtime only   |
| Local models and runners | Local config directory               | Downloaded from GitHub / Hugging Face only |

Clear all stored data from the app's settings, or delete the `cheating-daddy-config` directory, to
remove everything this application keeps.
