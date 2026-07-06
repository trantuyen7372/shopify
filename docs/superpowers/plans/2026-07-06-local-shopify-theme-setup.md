# Local Shopify Theme Dev Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Dawn-based Shopify theme at the root of this repo, installable and previewable locally against the user's existing development store.

**Architecture:** Install the Shopify CLI globally, scaffold Dawn into a temp directory (so we don't collide with this repo's existing `.git`), merge its contents into the repo root, gitignore Shopify-local artifacts, then verify the local dev preview server connects to the store.

**Tech Stack:** Node.js (already installed, v23.11.0), `@shopify/cli` (npm global package), Dawn theme (`https://github.com/Shopify/dawn.git`), git.

## Global Constraints

- Theme code lives at the repo root, not a subfolder (per approved design doc `docs/superpowers/specs/2026-07-06-local-shopify-theme-setup-design.md`).
- Do not overwrite or delete existing repo files: `README.md`, `.git/`, `.idea/`, `.claude/`, `.remember/`.
- Do not commit Shopify CLI local state (`.shopify/`) or other machine-specific artifacts.

---

### Task 1: Install and verify Shopify CLI

**Files:** None (global npm install; no repo files change).

**Interfaces:**
- Produces: a working `shopify` command on PATH, used by Task 2 and Task 4.

- [ ] **Step 1: Install the Shopify CLI globally**

Run: `npm install -g @shopify/cli`
Expected: npm reports the package added, no error exit code.

- [ ] **Step 2: Verify the CLI is on PATH and runs**

Run: `shopify version`
Expected: prints a version string, e.g. `3.x.x` (any non-error version output is a pass).

No commit needed — this step touches no repo files.

---

### Task 2: Scaffold Dawn into the repo root

**Files:**
- Create: full Dawn theme tree at repo root — `sections/`, `blocks/`, `snippets/`, `templates/`, `assets/`, `config/`, `locales/`, `layout/`, plus Dawn's own `.gitignore`, `.theme-check.yml`, `package.json`, etc.
- Temp (deleted before commit): `/tmp/dawn-scaffold/` (or equivalent OS temp path) — intermediate clone location, never part of the repo.

**Interfaces:**
- Consumes: `shopify` CLI from Task 1.
- Produces: Dawn's on-disk theme structure at repo root, consumed by Task 3 (.gitignore merge) and Task 4 (theme dev preview).

- [ ] **Step 1: Scaffold Dawn into a temp directory (not the repo root directly, to avoid the CLI colliding with this repo's existing `.git`)**

Run: `shopify theme init /tmp/dawn-scaffold --clone-url https://github.com/Shopify/dawn.git`
Expected: command completes, `/tmp/dawn-scaffold/` now contains the Dawn theme files (including its own `.git/`).

- [ ] **Step 2: Verify the scaffold looks like a Dawn theme**

Run: `ls /tmp/dawn-scaffold`
Expected: output includes `sections`, `snippets`, `templates`, `config`, `locales`, `layout`, `assets`.

- [ ] **Step 3: Remove Dawn's own git history (we keep this repo's git history, not Dawn's)**

Run: `rm -rf /tmp/dawn-scaffold/.git`
Expected: no output; `/tmp/dawn-scaffold/.git` no longer exists.

- [ ] **Step 4: Copy the scaffold into the repo root without touching existing files**

Run: `cp -Rn /tmp/dawn-scaffold/. /Users/duka/Work/Gin/Lucas/shopify/`
Expected: no output. `-n` (no-clobber) ensures `README.md` and any other existing file at repo root is left untouched; if Dawn ships its own `README.md`, ours wins and Dawn's is skipped.

- [ ] **Step 5: Clean up the temp scaffold**

Run: `rm -rf /tmp/dawn-scaffold`
Expected: no output.

- [ ] **Step 6: Verify the repo root now has the Dawn structure**

Run: `ls /Users/duka/Work/Gin/Lucas/shopify`
Expected: output includes `sections`, `snippets`, `templates`, `config`, `locales`, `layout`, `assets`, alongside the pre-existing `README.md`, `.idea`, `.claude`, `.remember`.

- [ ] **Step 7: Stage and commit the scaffolded theme**

Run:
```bash
git add sections blocks snippets templates assets config locales layout package.json .theme-check.yml 2>/dev/null
git commit -m "Scaffold Dawn theme at repo root"
```
Expected: commit succeeds, `git log --oneline -1` shows the new commit.

---

### Task 3: Gitignore Shopify-local artifacts

**Files:**
- Modify: `.gitignore` (create if Dawn didn't ship one, merge if it did).

**Interfaces:**
- Consumes: repo root from Task 2.
- Produces: a `.gitignore` that keeps `.shopify/` (CLI local state) out of git, consumed implicitly by Task 4 (running `shopify theme dev` creates `.shopify/`).

- [ ] **Step 1: Check whether `.gitignore` already exists and what it contains**

Run: `cat /Users/duka/Work/Gin/Lucas/shopify/.gitignore 2>/dev/null || echo "NO_GITIGNORE"`
Expected: either Dawn's existing gitignore contents, or `NO_GITIGNORE`.

- [ ] **Step 2: Ensure `.shopify/` is ignored**

If `.gitignore` exists and lacks a `.shopify/` entry, append it:
```bash
grep -qxF '.shopify/' /Users/duka/Work/Gin/Lucas/shopify/.gitignore 2>/dev/null || echo '.shopify/' >> /Users/duka/Work/Gin/Lucas/shopify/.gitignore
```
If `NO_GITIGNORE` was printed in Step 1, create it instead:
```bash
printf '.shopify/\nnode_modules/\n' > /Users/duka/Work/Gin/Lucas/shopify/.gitignore
```
Expected: no output (append) or file created (create case).

- [ ] **Step 3: Verify**

Run: `cat /Users/duka/Work/Gin/Lucas/shopify/.gitignore`
Expected: `.shopify/` appears as a line in the file.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "Ignore Shopify CLI local state"
```
Expected: commit succeeds (or "nothing to commit" if Dawn's shipped `.gitignore` already covered this — in that case skip the commit).

---

### Task 4: Connect to the dev store and verify local preview

**Files:** None expected to be committed (this task is a live verification step; `.shopify/` created here is already gitignored by Task 3).

**Interfaces:**
- Consumes: theme tree from Task 2, `.gitignore` from Task 3, `shopify` CLI from Task 1.
- Produces: a confirmed-working local preview loop, the deliverable of this whole plan.

- [ ] **Step 1: Start the local theme dev server**

Run (from repo root): `shopify theme dev`
Expected: CLI opens a browser for Shopify login (first run only), then prompts to select a store — choose the existing development store. Once connected, it prints a local preview URL, typically `http://127.0.0.1:9292`.

- [ ] **Step 2: Confirm the preview loads**

Open the printed local URL in a browser.
Expected: the Dawn storefront renders using the connected dev store's data (products/pages), not an error page.

- [ ] **Step 3: Confirm hot reload works**

Find which section renders first on the homepage:
Run: `head -20 templates/index.json`
Expected: JSON listing section keys under `"order"` / `"sections"` — note the first section's `"type"` value (e.g. `image-banner`), which maps to `sections/<type>.liquid`.

Edit `sections/<type>.liquid` from the previous step — change any literal visible text string.
Expected: the local preview updates within a few seconds without manually restarting `shopify theme dev`.

- [ ] **Step 4: Revert the throwaway edit from Step 3**

Run: `git checkout -- sections/<type>.liquid` (substitute the actual filename edited in Step 3)
Expected: file reverts to the committed scaffold version.

- [ ] **Step 5: Stop the dev server**

Press `Ctrl+C` in the terminal running `shopify theme dev`.

No commit needed — this task only verifies the setup from Tasks 1–3 works end to end.
