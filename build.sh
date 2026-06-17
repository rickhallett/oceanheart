#!/usr/bin/env bash
set -euo pipefail

HUGO_VERSION="${HUGO_VERSION:-0.159.1}"

run_matching_hugo() {
  local bin="$1"

  if [[ "${bin}" == */* ]]; then
    [[ -x "${bin}" ]] || return 1
  else
    command -v "${bin}" >/dev/null 2>&1 || return 1
    bin="$(command -v "${bin}")"
  fi

  current_hugo="$("${bin}" version)"
  if [[ "${current_hugo}" == *"hugo v${HUGO_VERSION}"* || "${current_hugo}" == *"hugo ${HUGO_VERSION}"* ]]; then
    "${bin}"
    exit 0
  fi

  return 1
}

run_matching_hugo hugo || true
run_matching_hugo /opt/homebrew/bin/hugo || true
run_matching_hugo /usr/local/bin/hugo || true

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Hugo ${HUGO_VERSION} is required for Vercel builds; no matching local binary found." >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64) hugo_arch="Linux-64bit" ;;
  aarch64|arm64) hugo_arch="linux-arm64" ;;
  *)
    echo "Unsupported Linux architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

archive="hugo_extended_${HUGO_VERSION}_${hugo_arch}.tar.gz"
url="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${archive}"

curl -fsSL "${url}" -o "${tmp_dir}/${archive}"
tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
"${tmp_dir}/hugo"
