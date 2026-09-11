#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${1:-}"
CLIENT_ID="${2:-}"
if [ "$(id -u)" -ne 0 ]; then
  printf 'installer must run as root\n' >&2
  exit 77
fi
if [ "$(cat /etc/studio-machine-role 2>/dev/null || true)" != "runtime" ]; then
  printf 'runtime role required\n' >&2
  exit 78
fi
if ! [[ "$BENCH_ROOT" =~ ^/opt/studio/releases/sha256-[0-9a-f]{64}/bench$ ]]; then
  printf 'bench root must be an immutable Studio release\n' >&2
  exit 64
fi
if ! [[ "$CLIENT_ID" =~ ^c[0-9]{4,}$ ]]; then
  printf 'client ID must match cNNNN\n' >&2
  exit 64
fi
if [ ! -f "$BENCH_ROOT/scripts/provision/recover-durable-jobs.ts" ]; then
  printf 'recovery entrypoint missing\n' >&2
  exit 66
fi
if [ "$(realpath -e "$BENCH_ROOT")" != "$BENCH_ROOT" ] || [ "$(stat -c %U "$BENCH_ROOT")" != "root" ]; then
  printf 'bench root must be canonical and root-owned\n' >&2
  exit 66
fi
if [ ! -f "/var/lib/studio-pi-runtime/$CLIENT_ID/jobs.sqlite" ]; then
  printf 'durable job database missing\n' >&2
  exit 66
fi

UNIT_PATH="/etc/systemd/system/studio-pi-recovery@.service"
TIMER_PATH="/etc/systemd/system/studio-pi-recovery@.timer"
{
  printf '%s\n' '[Unit]' 'Description=Recover durable Studio Pi jobs for %i' 'After=local-fs.target'
  printf '\n%s\n' '[Service]' 'Type=oneshot' 'User=studio-runtime' 'Group=studio-runtime'
  printf 'WorkingDirectory=%s\n' "$BENCH_ROOT"
  printf 'ExecStart=/usr/local/bin/node %s/scripts/provision/recover-durable-jobs.ts %%i /var/lib/studio-pi-runtime/%%i\n' "$BENCH_ROOT"
  printf '%s\n' 'NoNewPrivileges=true' 'PrivateDevices=true' 'PrivateTmp=true' 'ProtectHome=true' 'ProtectSystem=strict' 'RestrictAddressFamilies=AF_UNIX' 'ReadWritePaths=/var/lib/studio-pi-runtime/%i'
} > "$UNIT_PATH"
{
  printf '%s\n' '[Unit]' 'Description=Periodically recover durable Studio Pi jobs for %i'
  printf '\n%s\n' '[Timer]' 'OnBootSec=15s' 'OnUnitActiveSec=30s' 'AccuracySec=1s' 'Unit=studio-pi-recovery@%i.service'
  printf '\n%s\n' '[Install]' 'WantedBy=timers.target'
} > "$TIMER_PATH"
chown root:root "$UNIT_PATH" "$TIMER_PATH"
chmod 0644 "$UNIT_PATH" "$TIMER_PATH"
systemctl daemon-reload
systemctl enable --now "studio-pi-recovery@$CLIENT_ID.timer"
systemctl start "studio-pi-recovery@$CLIENT_ID.service"
systemctl --quiet is-active "studio-pi-recovery@$CLIENT_ID.timer"
printf '{"clientId":"%s","timer":"active"}\n' "$CLIENT_ID"
