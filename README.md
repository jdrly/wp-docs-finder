# WP Docs Finder

Standalone stdio MCP server for searching cached official WordPress developer documentation.

The bundled cache covers:

- WordPress theme development docs
- WordPress block editor docs

Tailwind docs are intentionally excluded because Tailwind has its own native MCP path.

## Quick Install

From a cloned checkout:

```bash
pnpm install
pnpm run install:codex
```

For Claude Code:

```bash
pnpm install
pnpm run install:claude-code
```

For package-style setup after this repo is uploaded to GitHub:

```bash
bash scripts/install-codex.sh --package github:<owner>/wp-docs-finder
bash scripts/install-claude-code.sh --package github:<owner>/wp-docs-finder
```

Replace `<owner>` with the GitHub user or organization.

See [INSTALL.md](./INSTALL.md) for manual config snippets and installer options.

## Agentic Setup Prompt

Paste this into Codex, Claude Code, or another coding agent:

```text
Install wp-docs-finder as an MCP server for me.

Repository:
https://github.com/<owner>/wp-docs-finder

Requirements:
- Inspect my existing MCP/client config before editing it.
- Prefer pnpm if available; use npx fallback only if pnpm is missing.
- For Codex, install the server as `wp-docs-finder` in `${CODEX_HOME:-$HOME/.codex}/config.toml`.
- For Claude Code, use `claude mcp add wp-docs-finder --scope local` unless I ask for user/project scope.
- Do not remove or rewrite unrelated MCP servers.
- Back up any config file before changing it.
- Verify the MCP server exposes `search_docs`, `get_doc`, and `list_doc_scopes`.
- After setup, run a test query for `theme.json color palette` and report the first result URL.
```

## Manual Codex Config

Recommended package-style config:

```toml
[mcp_servers.wp-docs-finder]
command = "pnpm"
args = ["dlx", "github:<owner>/wp-docs-finder"]
```

Fallback for users without pnpm:

```toml
[mcp_servers.wp-docs-finder]
command = "npx"
args = ["-y", "github:<owner>/wp-docs-finder"]
```

Local development:

```toml
[mcp_servers.wp-docs-finder]
command = "node"
args = ["/absolute/path/to/wp-docs-finder/src/server.js"]
```

## Manual Claude Code Install

Recommended package-style install:

```bash
claude mcp add wp-docs-finder --scope local -- pnpm dlx github:<owner>/wp-docs-finder
```

Fallback for users without pnpm:

```bash
claude mcp add wp-docs-finder --scope local -- npx -y github:<owner>/wp-docs-finder
```

Use `--scope user` instead of `--scope local` if you want the server available across all Claude Code projects.

## Tools

- `search_docs`: search WordPress theme and block editor docs.
- `get_doc`: fetch a full cached chunk by id.
- `list_doc_scopes`: show cached scope counts.

## Development

Install dependencies:

```bash
pnpm install
```

Run the server:

```bash
pnpm start
```

Refresh the docs cache:

```bash
pnpm run docs:update
```

Commit `data/docs.jsonl` and `data/manifest.json` after refreshing the cache.
