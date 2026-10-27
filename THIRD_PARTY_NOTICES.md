# Third-Party Notices — Ổi Browser

**Ổi Browser** (`https://github.com/jangtrinh/oi-browser`) is a first-party, local-first agentic AI browser workspace authored by **Jang Trinh** (`@jangtrinh`).

## 1. Runtime & Standard Library
- **Node.js 22+ Built-in Modules** (`node:http`, `node:sqlite`, `node:fs`, `node:path`, `node:child_process`, `node:crypto`): Licensed under the MIT License by the OpenJS Foundation and Node.js contributors.

## 2. Optional Development & Verification Tooling
- **Playwright (`playwright`)**: Used exclusively for local automated E2E browser testing (`devDependencies`). Licensed under the Apache License 2.0 by Microsoft Corporation.

## 3. External CLI Harnesses (User-Installed on Host)
- `claude`, `agy`, `codex`, `grok`, and `orca` are external command-line tools invoked from the user's local `$PATH` when present; no binary or proprietary code from these tools is bundled or redistributed in this repository.
