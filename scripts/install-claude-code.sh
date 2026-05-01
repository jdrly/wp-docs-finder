#!/usr/bin/env bash
set -eu

server_name="wp-docs-finder"
scope="local"
mode="auto"
package_spec=""
dry_run="false"

usage() {
	cat <<'USAGE'
Install wp-docs-finder into Claude Code MCP config.

Usage:
  bash scripts/install-claude-code.sh --local
  bash scripts/install-claude-code.sh --package github:<owner>/wp-docs-finder
  bash scripts/install-claude-code.sh --package wp-docs-finder --scope user

Options:
  --local              Use this checkout via node /path/to/src/server.js.
  --package <spec>     Use package manager execution. Prefers pnpm dlx, falls back to npx.
  --pnpm <spec>        Force pnpm dlx with a package spec.
  --npx <spec>         Force npx -y with a package spec.
  --scope <scope>      Claude Code scope: local, user, or project. Defaults to local.
  --dry-run            Print the claude command without running it.
  -h, --help           Show this help.
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
		--scope)
			scope="${2:-}"
			shift 2
			;;
		--dry-run)
			dry_run="true"
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

case "$scope" in
	local|user|project) ;;
	*)
		echo "Invalid scope: $scope. Use local, user, or project." >&2
		exit 2
		;;
esac

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
runner_args=()

if [ "$mode" = "local" ]; then
	command -v node >/dev/null 2>&1 || {
		echo "node not found." >&2
		exit 1
	}
	runner_command="node"
	runner_args=("$repo_dir/src/server.js")
else
	if [ -z "$package_spec" ]; then
		echo "Package spec required. Example: --package github:<owner>/wp-docs-finder" >&2
		exit 2
	fi

	if [ "$mode" = "pnpm" ]; then
		command -v pnpm >/dev/null 2>&1 || {
			echo "pnpm not found. Install pnpm or use --npx." >&2
			exit 1
		}
		runner_command="pnpm"
		runner_args=(dlx "$package_spec")
	elif [ "$mode" = "npx" ]; then
		command -v npx >/dev/null 2>&1 || {
			echo "npx not found. Install npm/npx or use --pnpm." >&2
			exit 1
		}
		runner_command="npx"
		runner_args=(-y "$package_spec")
	elif command -v pnpm >/dev/null 2>&1; then
		runner_command="pnpm"
		runner_args=(dlx "$package_spec")
	else
		command -v npx >/dev/null 2>&1 || {
			echo "Neither pnpm nor npx was found. Install one of them or use --local from a checkout." >&2
			exit 1
		}
		runner_command="npx"
		runner_args=(-y "$package_spec")
	fi
fi

cmd=(claude mcp add "$server_name" --scope "$scope" -- "$runner_command" "${runner_args[@]}")

if [ "$dry_run" = "true" ]; then
	printf '%q ' "${cmd[@]}"
	printf '\n'
	exit 0
fi

command -v claude >/dev/null 2>&1 || {
	echo "Claude Code CLI not found. Install Claude Code, then rerun this command." >&2
	exit 1
}

"${cmd[@]}"
