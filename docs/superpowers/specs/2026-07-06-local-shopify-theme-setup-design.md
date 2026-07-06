# Local Shopify Theme Dev Setup — Design

## Goal
Set up a local Shopify theme development environment in this repo, forked from Dawn (Shopify's default OS 2.0 theme), connected to an existing development store for live preview.

## Context
- Repo is currently empty aside from `README.md` and IDE/tooling metadata (`.idea/`, `.claude/`, `.remember/`).
- Node.js v23.11.0 and git are already installed. Shopify CLI is not installed.
- User has an existing Shopify development store to connect to.
- Theme code will live at the repo root (not a subfolder).

## Approach
1. **Install Shopify CLI** globally via npm (`npm install -g @shopify/cli`).
2. **Scaffold the theme** at the repo root using `shopify theme init`, cloning Dawn (`https://github.com/Shopify/dawn.git`) as the starting point. This gives the standard Online Store 2.0 folder structure: `sections/`, `blocks/`, `snippets/`, `templates/`, `assets/`, `config/`, `locales/`.
3. **Authenticate & connect** the CLI to the existing dev store — `shopify theme dev` triggers a browser login + store selection on first run.
4. **Local preview** via `shopify theme dev`, which runs a local server with hot-reload, rendering live data (products, pages, etc.) from the connected dev store.
5. **`.gitignore`** additions for Shopify-specific local artifacts (e.g. `.shopify/`).
6. **Commit** the scaffolded theme as the new baseline for this repo.

## Out of scope
- CI/CD deploy pipeline for the theme.
- Custom build tooling (Vite/webpack) beyond what Shopify CLI provides.
- Shopify app/extension setup.

## Verification
- `shopify theme dev` runs without error and serves a working local preview URL.
- The store selected during auth matches the user's existing dev store.
- Repo contains the standard Dawn folder structure after scaffolding, committed to git.
