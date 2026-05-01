# Quick Install

`wp-docs-finder` is a stdio MCP server for cached WordPress theme and block editor docs.

## Automatic Codex Install

From a cloned checkout:

```bash
bash scripts/install-codex.sh --local
```

With npm scripts:

```bash
npm install
npm run install:codex
```

For package-style setup from GitHub:

```bash
bash scripts/install-codex.sh --package github:<owner>/wp-docs-finder
```

The installer writes to `${CODEX_HOME:-$HOME/.codex}/config.toml`. It creates a timestamped backup before changing an existing config and refuses to overwrite an existing `wp-docs-finder` entry unless `--force` is passed.

## Automatic Claude Code Install

From a cloned checkout:

```bash
bash scripts/install-claude-code.sh --local
```

With npm scripts:

```bash
npm install
npm run install:claude-code
```

For package-style setup from GitHub:

```bash
bash scripts/install-claude-code.sh --package github:<owner>/wp-docs-finder
```

By default, the Claude Code installer uses `--scope local`. Use `--scope user` for all projects, or `--scope project` when you want a shared project `.mcp.json` entry:

```bash
bash scripts/install-claude-code.sh --package github:<owner>/wp-docs-finder --scope user
```

It uses `pnpm dlx` when pnpm is installed and falls back to `npx -y` otherwise.

## Codex From GitHub

After uploading this repo to GitHub, add this to your Codex config:

```toml
[mcp_servers.wp-docs-finder]
command = "pnpm"
args = ["dlx", "github:<owner>/wp-docs-finder"]
```

Replace `<owner>` with the GitHub user or organization.

If pnpm is not available, npm users can run the same package with `npx`:

```toml
[mcp_servers.wp-docs-finder]
command = "npx"
args = ["-y", "github:<owner>/wp-docs-finder"]
```

Or install the command globally with npm:

```bash
npm install -g github:<owner>/wp-docs-finder
```

```toml
[mcp_servers.wp-docs-finder]
command = "wp-docs-finder"
args = []
```

## Codex From Local Checkout

For local development before publishing:

```toml
[mcp_servers.wp-docs-finder]
command = "node"
args = ["/absolute/path/to/wp-docs-finder/src/server.js"]
```

## Claude Code Manual Install

Package-style install:

```bash
claude mcp add wp-docs-finder --scope local -- pnpm dlx github:<owner>/wp-docs-finder
```

Fallback without pnpm:

```bash
claude mcp add wp-docs-finder --scope local -- npx -y github:<owner>/wp-docs-finder
```

Or install globally with npm:

```bash
npm install -g github:<owner>/wp-docs-finder
claude mcp add wp-docs-finder --scope local -- wp-docs-finder
```

## Refresh Docs Cache

```bash
pnpm install
pnpm run docs:update
```

Commit `data/docs.jsonl` and `data/manifest.json` after refreshing the cache.
