# Security audit — 2026-11-10

## Scope and findings

- JSON import and saved-state migration lacked size/count/string limits, dangerous-key rejection and parent-cycle detection.
- Validation mutated the untrusted input object and retained it as live state.
- Corrupt `localStorage` was replaced with a default map during startup, risking loss of the recoverable original value.
- Parent traversal and recursive descendant logic can freeze on malicious parent cycles unless cycles are rejected before state activation.
- User text is generally rendered with `textContent` or escaped before HTML insertion. No remote scripts, external communications, `eval`, `Function` constructor or common API-token patterns were found.

## Changes

- Limit JSON to 2 MiB, 2,000 nodes and 10,000 links.
- Validate IDs, text/notes lengths, coordinates, parent references, parent cycles, links, viewport values and line colors.
- Reject prototype-pollution keys and rebuild accepted state in a null-prototype node dictionary.
- Preserve corrupt or oversized saved data instead of overwriting it; start with a temporary safe map and show a recovery status.
- Roll back an imported map if `localStorage` persistence fails; report file read errors.
- Freeze a corrupt primary storage key and route all subsequent editing/saving to a separate recovery key.
- Load a valid recovery record when it is the only remaining key, without recreating or changing the primary key.
- Replace recursive descendant traversal with an iterative walk and roll back editing, deletion, undo and other common mutations when saving fails.
- Add user-initiated speech input with an editable confirmation step and explicit copy/open handoff for ChatGPT, Gemini and Claude; canceling speech confirmation changes no data and map data is never sent automatically.
- Restore pan and zoom when `fit()` cannot persist its calculated viewport.
- Apply the same 2 MiB serialization limit to normal editing, saving, export, import and startup reload; bound normal node/link creation and coordinates.
- Run the security regression test automatically for pull requests with a read-only GitHub Actions token.

## Verification

- Browser smoke test: node create/edit, save, reload persistence, three-point cycle creation and AI-copy action passed.
- Browser E2E: forced `QuotaExceededError` restored the pre-fit pan/zoom, while drag and synthetic pinch persisted normally; speech review/cancel left storage unchanged and edited confirmation persisted only after approval.
- Static checks: no remote scripts, `eval`, `Function` constructor or common API secrets; `git diff --check` passed.
- `security-tests.mjs` covers valid import, parent cycles, oversized strings, invalid coordinates, excessive links, prototype pollution, export/reload compatibility, serialization limits, corrupt-primary recovery isolation and recovery-key restart. PASS with Node.js v24.22.2 on 2026-11-10.

## Residual risks

- Full automated drag/touch/pinch and file-chooser tests remain manual; core persistence and validation paths are covered at the function level.
- Similarity analysis is quadratic in visible node count. Imports are capped at 2,000 nodes, but AI-check can still be slow on very large legitimate maps; a lower interactive-analysis cap or worker is recommended later.
- Undo keeps up to 80 full snapshots and can consume substantial memory on large maps. A byte budget or patch-based history is recommended later.
- The single-file app uses inline JavaScript, so a strict nonce/hash-based CSP would require a larger packaging change.

## Suggested GitHub settings (not applied)

- Protect `main`: require pull requests, one approval, passing checks and blocked force-push/deletion.
- Enable secret scanning/push protection, Dependabot alerts and CodeQL if available.
- Restrict Pages deployment to reviewed commits/environment approvals if publication should be controlled.
