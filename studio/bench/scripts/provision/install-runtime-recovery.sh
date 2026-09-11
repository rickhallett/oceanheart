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

STATE_ROOT="/var/lib/studio-pi-runtime/$CLIENT_ID"
PID_FILE="/run/studio-pi-recovery-$CLIENT_ID.pid"
LOG_FILE="$STATE_ROOT/recovery-supervisor.log"
ENTRYPOINT="$BENCH_ROOT/scripts/provision/recover-durable-jobs.ts"
EXPECTED_COMMAND="$ENTRYPOINT $CLIENT_ID $STATE_ROOT --watch 30"
if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ "$EXISTING_PID" =~ ^[0-9]+$ ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    PROCESS_COMMAND="$(tr '\000' ' ' < "/proc/$EXISTING_PID/cmdline")"
    case "$PROCESS_COMMAND" in
      *"$EXPECTED_COMMAND"*)
        printf '{"clientId":"%s","supervisor":"already-active"}\n' "$CLIENT_ID"
        exit 0
        ;;
      *)
        printf 'pid file conflicts with an unrelated live process\n' >&2
        exit 73
        ;;
    esac
  fi
fi
rm -f "$PID_FILE"
if [ ! -e "$LOG_FILE" ]; then
  install -o studio-runtime -g studio-runtime -m 0600 /dev/null "$LOG_FILE"
else
  chown studio-runtime:studio-runtime "$LOG_FILE"
  chmod 0600 "$LOG_FILE"
fi
/sbin/start-stop-daemon --start --background --make-pidfile \
  --pidfile "$PID_FILE" --chuid studio-runtime:studio-runtime \
  --chdir "$BENCH_ROOT" --umask 077 --output "$LOG_FILE" \
  --startas /usr/local/bin/node -- \
  "$ENTRYPOINT" "$CLIENT_ID" "$STATE_ROOT" --watch 30
for attempt in 1 2 3 4 5; do
  if [ -s "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    PROCESS_COMMAND="$(tr '\000' ' ' < "/proc/$(cat "$PID_FILE")/cmdline")"
    case "$PROCESS_COMMAND" in
      *"$EXPECTED_COMMAND"*)
        printf '{"clientId":"%s","supervisor":"active"}\n' "$CLIENT_ID"
        exit 0
        ;;
    esac
  fi
  sleep 1
done
printf 'recovery supervisor did not become ready\n' >&2
exit 70
