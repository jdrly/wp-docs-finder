#!/usr/bin/env bash
set -eu

server_name="wp-docs-finder"
mode="auto"
package_spec=""
force="false"

usage() {
	cat <<'USAGE'
Install wp-docs-finder into Codex MCP config.

Usage:
  bash scripts/install-codex.sh --local
  bash scripts/install-codex.sh --package github:<owner>/wp-docs-finder
  bash scripts/install-codex.sh --package wp-docs-finder

Options:
  --local              Use this checkout via node /path/to/src/server.js.
  --package <spec>     Use package manager execution. Prefers pnpm dlx, falls back to npx.
  --pnpm <spec>        Force pnpm dlx with a package spec.
  --npx <spec>         Force npx -y with a package spec.
  --force              Replace an existing wp-docs-finder config block.
  -h, --help           Show this help.

Environment:
  CODEX_HOME           Defaults to $HOME/.codex.
USAGE
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--local)
			mode="local"
			shift
			;;
		--package)
			mode="auto"
			package_spec="${2:-}"
			shift 2
			;;
		--pnpm)
			mode="pnpm"
			package_spec="${2:-}"
			shift 2
			;;
		--npx)
			mode="npx"
			package_spec="${2:-}"
			shift 2
			;;
		--force)
			force="true"
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
codex_home="${CODEX_HOME:-$HOME/.codex}"
config_file="$codex_home/config.toml"

toml_string() {
	printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

choose_runner() {
	if [ "$mode" = "pnpm" ]; then
		command -v pnpm >/dev/null 2>&1 || {
			echo "pnpm not found. Install pnpm or use --npx." >&2
			exit 1
		}
		command_value="pnpm"
		args_value="[$(toml_string dlx), $(toml_string "$package_spec")]"
		return
	fi

	if [ "$mode" = "npx" ]; then
		command -v npx >/dev/null 2>&1 || {
			echo "npx not found. Install npm/npx or use --pnpm." >&2
			exit 1
		}
		command_value="npx"
		args_value="[$(toml_string -y), $(toml_string "$package_spec")]"
		return
	fi

	if command -v pnpm >/dev/null 2>&1; then
		command_value="pnpm"
		args_value="[$(toml_string dlx), $(toml_string "$package_spec")]"
		return
	fi

	command -v npx >/dev/null 2>&1 || {
		echo "Neither pnpm nor npx was found. Install one of them or use --local from a checkout." >&2
		exit 1
	}
	command_value="npx"
	args_value="[$(toml_string -y), $(toml_string "$package_spec")]"
}

if [ "$mode" = "local" ]; then
	command -v node >/dev/null 2>&1 || {
		echo "node not found." >&2
		exit 1
	}
	command_value="node"
	args_value="[$(toml_string "$repo_dir/src/server.js")]"
else
	if [ -z "$package_spec" ]; then
		echo "Package spec required. Example: --package github:<owner>/wp-docs-finder" >&2
		exit 2
	fi
	choose_runner
fi

mkdir -p "$codex_home"
touch "$config_file"

if grep -q "^\[mcp_servers\.$server_name\]" "$config_file"; then
	if [ "$force" != "true" ]; then
		echo "$server_name already exists in $config_file. Use --force to replace it." >&2
		exit 1
	fi
	backup_file="$config_file.bak.$(date +%Y%m%d%H%M%S)"
	cp "$config_file" "$backup_file"
	awk -v section="[mcp_servers.$server_name]" '
		$0 == section { skip = 1; next }
		skip && /^\[mcp_servers\./ { skip = 0 }
		!skip { print }
	' "$backup_file" > "$config_file"
	echo "Backup written: $backup_file"
elif [ -s "$config_file" ]; then
	backup_file="$config_file.bak.$(date +%Y%m%d%H%M%S)"
	cp "$config_file" "$backup_file"
	echo "Backup written: $backup_file"
fi

{
	printf '\n[mcp_servers.%s]\n' "$server_name"
	printf 'command = %s\n' "$(toml_string "$command_value")"
	printf 'args = %s\n' "$args_value"
} >> "$config_file"

echo "Installed $server_name in $config_file"
