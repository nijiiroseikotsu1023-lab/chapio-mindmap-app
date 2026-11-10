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

## Verification

- Browser smoke test: node create/edit, save, reload persistence, three-point cycle creation and AI-copy action passed.
- Static checks: no remote scripts, `eval`, `Function` constructor or common API secrets; `git diff --check` passed.
- `security-tests.mjs` covers valid import, parent cycles, oversized strings, invalid coordinates, excessive links and prototype pollution. It was added but not run locally because Node.js is unavailable in the execution environment.

## Residual risks

- Full automated drag/touch/pinch and file-chooser tests remain to be run in CI or a Node-enabled workstation.
- Similarity analysis is quadratic in visible node count. Imports are capped at 2,000 nodes, but AI-check can still be slow on very large legitimate maps; a lower interactive-analysis cap or worker is recommended later.
- Undo keeps up to 80 full snapshots and can consume substantial memory on large maps. A byte budget or patch-based history is recommended later.
- The single-file app uses inline JavaScript, so a strict nonce/hash-based CSP would require a larger packaging change.

## Suggested GitHub settings (not applied)

- Protect `main`: require pull requests, one approval, passing checks and blocked force-push/deletion.
- Enable secret scanning/push protection, Dependabot alerts and CodeQL if available.
- Restrict Pages deployment to reviewed commits/environment approvals if publication should be controlled.
