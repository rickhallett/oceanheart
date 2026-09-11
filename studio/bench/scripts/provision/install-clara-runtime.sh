#!/usr/bin/env bash
set -euo pipefail

BENCH_ROOT="${1:-}"
CLIENT_ID="${2:-}"
BINDING_FILE="${3:-}"
AUTHORIZATIONS_FILE="${4:-}"
PORT="${5:-}"
if [ "$(id -u)" -ne 0 ]; then
  printf 'installer must run as root\n' >&2
  exit 77
fi
if [ "$(cat /etc/studio-machine-role 2>/dev/null || true)" != "runtime" ]; then
  printf 'runtime role required\n' >&2
  exit 78
fi
if ! [[ "$BENCH_ROOT" =~ ^/opt/studio/releases/sha256-[0-9a-f]{64}/bench$ ]] ||
  ! [[ "$CLIENT_ID" =~ ^c[0-9]{4,}$ ]] ||
  ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  printf 'invalid immutable release, client or private port\n' >&2
  exit 64
fi
ENTRYPOINT="$BENCH_ROOT/scripts/provision/serve-clara-runtime.ts"
for file in "$ENTRYPOINT" "$BINDING_FILE" "$AUTHORIZATIONS_FILE"; do
  if [ ! -f "$file" ]; then
    printf 'runtime input missing\n' >&2
    exit 66
  fi
done
if [ "$(realpath -e "$BENCH_ROOT")" != "$BENCH_ROOT" ] || [ "$(stat -c %U "$BENCH_ROOT")" != "root" ]; then
  printf 'bench root must be canonical and root-owned\n' >&2
  exit 66
fi

STATE_ROOT="/var/lib/studio-pi-runtime/$CLIENT_ID"
PID_FILE="/run/studio-clara-runtime-$CLIENT_ID.pid"
LOG_FILE="$STATE_ROOT/clara-runtime.log"
EXPECTED_COMMAND="$ENTRYPOINT --binding $BINDING_FILE --authorizations $AUTHORIZATIONS_FILE --state-root $STATE_ROOT --port $PORT"
if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ "$EXISTING_PID" =~ ^[0-9]+$ ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    PROCESS_COMMAND="$(tr '\000' ' ' < "/proc/$EXISTING_PID/cmdline")"
    case "$PROCESS_COMMAND" in
      *"$EXPECTED_COMMAND"*)
        printf '{"clientId":"%s","runtime":"already-active","port":%s}\n' "$CLIENT_ID" "$PORT"
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
install -d -o studio-runtime -g studio-runtime -m 0700 "$STATE_ROOT"
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
  "$ENTRYPOINT" --binding "$BINDING_FILE" --authorizations "$AUTHORIZATIONS_FILE" \
  --state-root "$STATE_ROOT" --port "$PORT"
for attempt in 1 2 3 4 5; do
  if [ -s "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null &&
    /usr/local/bin/node -e "fetch('http://127.0.0.1:$PORT/healthz',{signal:AbortSignal.timeout(1000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    printf '{"clientId":"%s","runtime":"active","port":%s}\n' "$CLIENT_ID" "$PORT"
    exit 0
  fi
  sleep 1
done
FAILED_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ "$FAILED_PID" =~ ^[0-9]+$ ]] && kill -0 "$FAILED_PID" 2>/dev/null; then
  PROCESS_COMMAND="$(tr '\000' ' ' < "/proc/$FAILED_PID/cmdline")"
  case "$PROCESS_COMMAND" in
    *"$EXPECTED_COMMAND"*) kill "$FAILED_PID" 2>/dev/null || true ;;
  esac
fi
rm -f "$PID_FILE"
printf 'Clara runtime did not become ready\n' >&2
exit 70
