#!/usr/bin/env bash
set -euo pipefail

ROLE="${1:-}"
case "$ROLE" in
  runtime|builder) ;;
  *) printf 'usage: bootstrap-node24.sh runtime|builder\n' >&2; exit 64 ;;
esac
if [ "$(id -u)" -ne 0 ]; then
  printf 'bootstrap must run as root\n' >&2
  exit 77
fi
if [ "$(uname -m)" != "x86_64" ]; then
  printf 'unsupported architecture\n' >&2
  exit 78
fi

NODE_VERSION="24.20.0"
NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
NODE_SHA256="2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2"
NODE_ROOT="/opt/node-v${NODE_VERSION}"
export DEBIAN_FRONTEND=noninteractive
umask 027

APT_NETWORK_OPTIONS=(
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
  -o Acquire::Retries=2
)
apt-get "${APT_NETWORK_OPTIONS[@]}" update -qq
apt-get "${APT_NETWORK_OPTIONS[@]}" install -y --no-install-recommends ca-certificates curl xz-utils
if [ "$ROLE" = "builder" ]; then
  apt-get "${APT_NETWORK_OPTIONS[@]}" install -y --no-install-recommends git build-essential
fi

if [ ! -x "$NODE_ROOT/bin/node" ]; then
  TEMP_ROOT="$(mktemp -d /var/tmp/studio-node.XXXXXX)"
  trap 'rm -rf "$TEMP_ROOT"' EXIT
  curl --fail --silent --show-error --location \
    "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}" \
    --output "$TEMP_ROOT/$NODE_ARCHIVE"
  printf '%s  %s\n' "$NODE_SHA256" "$TEMP_ROOT/$NODE_ARCHIVE" | sha256sum --check --status
  mkdir "$TEMP_ROOT/unpacked"
  tar -xJf "$TEMP_ROOT/$NODE_ARCHIVE" -C "$TEMP_ROOT/unpacked" --strip-components=1
  chown -R root:root "$TEMP_ROOT/unpacked"
  chmod -R a+rX,go-w "$TEMP_ROOT/unpacked"
  mv "$TEMP_ROOT/unpacked" "$NODE_ROOT"
fi
chmod -R a+rX,go-w "$NODE_ROOT"
if [ "$($NODE_ROOT/bin/node --version)" != "v${NODE_VERSION}" ]; then
  printf 'installed Node version mismatch\n' >&2
  exit 79
fi
for executable in node npm npx corepack; do
  ln -sfn "$NODE_ROOT/bin/$executable" "/usr/local/bin/$executable"
done

if [ "$ROLE" = "runtime" ]; then
  SERVICE_USER="studio-runtime"
  SERVICE_HOME="/var/lib/studio"
  SERVICE_SHELL="/usr/sbin/nologin"
else
  SERVICE_USER="studio-builder"
  SERVICE_HOME="/var/lib/studio-builder"
  SERVICE_SHELL="/bin/bash"
fi
if ! getent group "$SERVICE_USER" >/dev/null; then
  groupadd --system "$SERVICE_USER"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_USER" --home-dir "$SERVICE_HOME" \
    --create-home --shell "$SERVICE_SHELL" "$SERVICE_USER"
fi
if [ "$(runuser -u "$SERVICE_USER" -- "$NODE_ROOT/bin/node" --version)" != "v${NODE_VERSION}" ]; then
  printf 'service user cannot execute pinned Node\n' >&2
  exit 80
fi
install -d -o root -g root -m 0755 /opt/studio /opt/studio/releases
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 "$SERVICE_HOME"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 "/var/lib/studio-pi-$ROLE"
printf '%s\n' "$ROLE" > /etc/studio-machine-role
chown root:root /etc/studio-machine-role
chmod 0644 /etc/studio-machine-role

printf '{"node":"v%s","role":"%s","serviceUser":"%s"}\n' \
  "$NODE_VERSION" "$ROLE" "$SERVICE_USER"
