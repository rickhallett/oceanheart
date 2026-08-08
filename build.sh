#!/usr/bin/env bash
set -euo pipefail

HUGO_VERSION="0.159.1"

node scripts/sync-share-routes.mjs --check
node --test deploy/oceanheart-blog-retirement/test/retirement.test.js

find_matching_hugo() {
  local candidate="$1"
  local candidate_path
  local current_hugo
  local command_name
  local version_token

  if [[ "${candidate}" == */* ]]; then
    [[ -x "${candidate}" ]] || return 1
    candidate_path="${candidate}"
  else
    command -v "${candidate}" >/dev/null 2>&1 || return 1
    candidate_path="$(command -v "${candidate}")"
  fi

  current_hugo="$("${candidate_path}" version)"
  read -r command_name version_token _ <<< "${current_hugo}"
  version_token="${version_token#v}"
  version_token="${version_token%%+*}"
  if [[ "${command_name}" == "hugo" && "${version_token}" == "${HUGO_VERSION}" ]]; then
    hugo_bin="${candidate_path}"
    return 0
  fi

  return 1
}

hugo_bin=""
for candidate in hugo /opt/homebrew/bin/hugo /usr/local/bin/hugo; do
  if find_matching_hugo "${candidate}"; then
    break
  fi
done

if [[ -z "${hugo_bin}" ]]; then
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "Hugo ${HUGO_VERSION} is required; no matching local binary found." >&2
    exit 1
  fi

  case "$(uname -m)" in
    x86_64|amd64)
      hugo_arch="Linux-64bit"
      archive_sha256="cded0ffbc7540c5cee330c2ad24d678a0d4a693e9c590cc05c1d1d5556a21aa4"
      ;;
    aarch64|arm64)
      hugo_arch="linux-arm64"
      archive_sha256="210c5e22631fa6a6bad3b6c623f8997a70d2ac306d61ca326d5f31753165779d"
      ;;
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
  archive_path="${tmp_dir}/${archive}"
  url="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${archive}"

  curl -fsSL "${url}" -o "${archive_path}"
  printf '%s  %s\n' "${archive_sha256}" "${archive_path}" | sha256sum --check --status
  tar -xzf "${archive_path}" -C "${tmp_dir}"
  hugo_bin="${tmp_dir}/hugo"
fi

"${hugo_bin}" --cleanDestinationDir --noBuildLock
node --test test/public-site.test.mjs
