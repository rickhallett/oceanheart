+++
title = "Process Supervision - systemd, cron, and supervisord"
date = "2026-03-10"
description = "Keeping long-running agent processes alive with systemd, cron, and supervisord."
tags = ["systemd", "cron", "supervisord", "supervision", "reliability", "containers", "bootcamp"]
step = 11
tier = 1
estimate = "3 hours"
bootcamp = 1
+++

Step 11 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model, signals, exit codes), Step 3 (filesystem as state), Step 9 (container internals, PID 1, entrypoint.sh)
**Leads to:** Step 12 (advanced bash)

---

## Why This Step Exists

In Step 1 you learned that processes are born, run, and die. In Step 9 you learned that
containers wrap processes in namespaces and cgroups. But neither step addressed the
question: what happens when a process dies unexpectedly?

If a web server crashes at 3am, who restarts it? If an agent process hangs on a stuck
API call, who kills it and tries again? If a cleanup job needs to run every night, who
schedules it? The answer in every case is a **supervisor** - a process whose job is
managing other processes.

Process supervision is the operational layer between "I wrote a program" and "it runs
reliably in production." Without it, a single segfault or OOM kill at 3am means the
service is down until a human notices and restarts it. With it, the service restarts in
seconds, logs what happened, and continues serving.

This step covers three tools at different levels of the supervision stack:

- **systemd** - the Linux init system; manages services, sockets, timers, and resource limits
- **cron** - time-based task scheduling; the oldest and simplest scheduler
- **supervisord** - a lightweight process manager popular in containers

But more importantly, it covers the **patterns** underneath these tools: crash-only design,
watchdog monitoring, graceful shutdown, health checking. These patterns are what you apply
when evaluating whether an agent's process management is sound.

> **AGENTIC GROUNDING:** The midget entrypoint.sh backgrounds Xvfb and fluxbox, then
> either runs a command or starts a shell. This is primitive process supervision - there
> is no restart on crash, no health check, no timeout on hung processes. Understanding
> supervision patterns shows what is missing and how to add it. When agents run for hours
> managing subprocesses (spawning tools, running tests, calling APIs), the agent IS a
> supervisor. Understanding supervision patterns helps the Operator verify that the agent
> handles subprocess lifecycle correctly.

---

## Table of Contents

1. [The PID 1 Problem](#1-the-pid-1-problem) (~25 min)
2. [systemd - The Linux Init System](#2-systemd---the-linux-init-system) (~50 min)
3. [cron - Time-Based Scheduling](#3-cron---time-based-scheduling) (~25 min)
4. [supervisord - Process Manager for Containers](#4-supervisord---process-manager-for-containers) (~20 min)
5. [Process Supervision Patterns](#5-process-supervision-patterns) (~25 min)
6. [Logging for Supervised Processes](#6-logging-for-supervised-processes) (~15 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [What to Read Next](#what-to-read-next)

---

## 1. The PID 1 Problem

*Estimated time: 25 minutes*

PID 1 is not just the first process. It is special. The kernel treats PID 1 differently
from every other process on the system, and this difference has concrete consequences
for signal handling, zombie reaping, and container lifecycle.

### Why PID 1 is special

Three properties distinguish PID 1 from all other processes:

**1. Signal immunity.** The kernel does not deliver signals to PID 1 unless PID 1 has
explicitly registered a handler for that signal. For any other process, sending SIGTERM
invokes the default handler (terminate). For PID 1, sending SIGTERM does nothing unless
the process has called `signal(SIGTERM, handler)` or equivalent. This is a kernel-level
protection: if PID 1 dies, the system is dead. The kernel prevents accidental termination.

```bash
# Demonstrate: send SIGTERM to PID 1 (init/systemd) on a running system
# This does nothing. systemd has handlers installed, but the kernel would
# not deliver the signal at all if it did not.
sudo kill -TERM 1
# System continues running normally
```

**2. Orphan reaping.** When a process dies, its parent must call `wait()` to collect the
exit status. If the parent dies first, the child becomes an orphan. The kernel reparents
orphans to PID 1. If PID 1 does not call `wait()` on these orphans, they become zombies -
entries in the process table that consume a PID slot and never go away.

```bash
# Create a zombie to observe the problem
# The parent exits immediately, leaving the child as a zombie
bash -c '(sleep 60 &); exit' &
sleep 1
ps aux | grep defunct
# The sleep process is a zombie until PID 1 reaps it
```

**3. System death on exit.** If PID 1 exits, the kernel panics (or, in a container, the
container stops). There is no fallback. PID 1 must stay alive.

### PID 1 in containers

In a container, the entrypoint process becomes PID 1 in the container's PID namespace.
It inherits all three special properties. This creates two common problems:

**Problem 1: Signal swallowing.** When you run `docker stop`, Docker sends SIGTERM to PID 1
inside the container. If PID 1 is a shell script that has not trapped SIGTERM, the signal
is silently ignored (because of the kernel's PID 1 signal protection). Docker waits 10
seconds (configurable with `--stop-timeout`), then sends SIGKILL. Your process never gets
a chance to clean up.

**Problem 2: Zombie accumulation.** If the container runs multiple processes (background
services, child processes spawned by the main application), and PID 1 does not reap
orphans, zombies accumulate. Each zombie holds a PID slot. If the PID limit is reached
(`pids.max` in cgroups, or the kernel's global PID limit), the container cannot spawn new
processes and effectively hangs.

### The `exec` fix

Look at the project's `entrypoint.sh`:

```bash
#!/bin/bash
set -e

# Start background services
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} -ac &
XVFB_PID=$!
sleep 1

# ...start fluxbox...

# Replace the shell with the target process
if [ $# -gt 0 ]; then
    exec "$@"
else
    exec /bin/bash
fi
```

The critical line is `exec "$@"`. Without `exec`, the shell remains PID 1 and the target
command runs as a child process. SIGTERM from `docker stop` goes to the shell (PID 1),
which ignores it. With `exec`, the target command **replaces** the shell and becomes PID 1
itself. If the target is Python, Node, or any program that registers a SIGTERM handler,
`docker stop` works correctly.

But this creates a new problem: after `exec`, the shell is gone. Xvfb and fluxbox were
children of the shell. They are now orphans, reparented to the new PID 1 (the target
process). If the target process does not call `wait()`, they become zombies when they exit.
Python, Node, and most interpreters do not reap arbitrary children. This is where init
systems come in.

### tini and dumb-init

`tini` (the Tiny Init) and `dumb-init` are minimal programs designed to be PID 1 in
containers. They do exactly two things:

1. Forward signals to children (solving the signal-swallowing problem)
2. Reap zombie processes (solving the orphan problem)

They do nothing else. They are approximately 10KB of compiled C.

```dockerfile
# Using tini in a Dockerfile
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y tini
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/opt/entrypoint.sh"]
```

When the container starts, tini is PID 1. It executes `entrypoint.sh` as a child process.
When `docker stop` sends SIGTERM, tini receives it (it has a handler registered) and
forwards it to the child. When any process in the container becomes a zombie, tini calls
`wait()` to reap it.

Docker 1.13+ has a built-in tini equivalent:

```bash
# Use --init to inject tini as PID 1
docker run --init myimage mycommand

# Equivalent to:
docker run --entrypoint /dev/init myimage mycommand -- mycommand
```

> **AGENTIC GROUNDING:** Agent processes spawned inside containers may fork child
> processes - running tests, spawning tool binaries, executing shell commands. Each
> child that exits while its parent is busy becomes an orphan reparented to PID 1. If
> PID 1 does not reap, zombies accumulate. This is not theoretical: a long-running agent
> that spawns hundreds of tool invocations over several hours can exhaust the PID space
> if zombies are not reaped. The fix is either `--init` on `docker run` or tini/dumb-init
> in the Dockerfile.

> **HISTORY:** The PID 1 problem in containers was a long-standing source of subtle bugs.
> Yelp published `dumb-init` in 2015 to address it. Thomas Orozco (Yelp) wrote the
> definitive explanation in "Avoiding PID 1 and Zombie Reaping in Docker." Docker added
> the `--init` flag in version 1.13 (2017). The underlying issue - that PID 1 has special
> signal handling - dates to the original Unix design. Ken Thompson's `init` (1971) was
> the first PID 1, and it had the same reaping responsibility.

---

## 2. systemd - The Linux Init System

*Estimated time: 50 minutes*

systemd is PID 1 on most modern Linux distributions (Debian, Ubuntu, Fedora, Arch, RHEL,
SUSE). It is the init system - the first process the kernel starts, responsible for
bringing up the entire userspace.

systemd is also controversial. Where classic Unix init was a small shell script runner,
systemd is a suite of over 60 binaries managing services, logging (journald), device
events (udevd), DNS resolution (resolved), time synchronization (timesyncd), and more.
The "systemd wars" were a genuine community conflict. But the controversy does not change
the practical reality: if you operate on Linux, you interact with systemd.

### Unit files

systemd manages everything through **unit files** - declarative configuration files that
describe what to run, how to run it, and what to do when it fails.

Unit files live in:
- `/etc/systemd/system/` - system-wide, admin-created (highest priority)
- `/usr/lib/systemd/system/` - installed by packages
- `~/.config/systemd/user/` - per-user services (no root required)

A minimal unit file for a service:

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/myapp/server.py
WorkingDirectory=/opt/myapp
User=myapp
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Breaking this down section by section:

**[Unit]** - metadata and dependencies.
- `Description` - human-readable name (shown in `systemctl status`)
- `After=network.target` - start this service after the network is up. This is ordering,
  not dependency. If you also want the service to fail if the network is not available,
  add `Requires=network.target`.

**[Service]** - how to run the process.
- `Type=simple` - the process started by `ExecStart` IS the service. systemd considers
  the service started immediately. This is the default and the right choice for most
  modern services that run in the foreground.
- `ExecStart` - the command to run. Must be an absolute path.
- `WorkingDirectory` - chdir before starting.
- `User` - run as this user (drops privileges from root).
- `Restart=on-failure` - restart the service if it exits with a non-zero exit code or is
  killed by a signal. Alternatives: `always` (restart regardless of exit code), `no`
  (never restart), `on-abnormal` (restart on signal/timeout/watchdog, not on clean exit).
- `RestartSec=5` - wait 5 seconds before restarting. Prevents tight restart loops that
  consume resources and spam logs.

**[Install]** - how to enable the service.
- `WantedBy=multi-user.target` - when enabled, this service starts during normal
  multi-user boot. This creates a symlink in the target's `.wants/` directory.

### Service types

systemd needs to know when a service is "ready" - when it has finished initialization
and is accepting requests. The `Type` directive tells systemd how to determine this.

| Type | How systemd detects readiness | Use when |
|------|-------------------------------|----------|
| `simple` | Immediately (process started = ready) | The process runs in foreground, no complex init |
| `exec` | After `ExecStart` binary is executed | Same as simple but distinguishes exec failure |
| `forking` | After the initial process exits (forks a daemon) | Legacy daemons that background themselves |
| `oneshot` | After the process exits | Run-once tasks (like database migration) |
| `notify` | When the process sends `READY=1` via `sd_notify()` | Services with complex startup that signal readiness |
| `dbus` | When a D-Bus name is acquired | D-Bus services |

`simple` is the default and correct for most modern software. Old-style daemons that
double-fork to background themselves need `forking`. If you control the code and want
precise readiness notification, use `notify` with the `sd_notify` API.

### Essential systemctl commands

```bash
# Start a service now
sudo systemctl start myapp.service

# Stop a service (sends SIGTERM, then SIGKILL after TimeoutStopSec)
sudo systemctl stop myapp.service

# Restart (stop then start)
sudo systemctl restart myapp.service

# Reload configuration without restart (if the service supports it)
sudo systemctl reload myapp.service

# View current status, recent logs, PID, memory usage
systemctl status myapp.service

# Enable the service to start on boot
sudo systemctl enable myapp.service

# Disable (do not start on boot)
sudo systemctl disable myapp.service

# Enable AND start in one command
sudo systemctl enable --now myapp.service

# Check if a service is active
systemctl is-active myapp.service

# Check if a service is enabled
systemctl is-enabled myapp.service

# List all running services
systemctl list-units --type=service --state=running

# List all failed services
systemctl list-units --type=service --state=failed

# Reload systemd after editing unit files
sudo systemctl daemon-reload
```

The last command is critical: after creating or modifying a unit file, you must run
`daemon-reload` for systemd to notice the change. Forgetting this is the most common
systemd mistake.

### Viewing logs with journalctl

systemd captures stdout and stderr from every service into the journal (via journald).
No log file configuration needed - the output goes to the journal by default.

```bash
# Follow logs for a service (like tail -f)
journalctl -u myapp.service -f

# Last 100 lines
journalctl -u myapp.service -n 100

# Logs since last boot
journalctl -u myapp.service -b

# Logs since a specific time
journalctl -u myapp.service --since "2026-03-10 14:00:00"

# Logs between two times
journalctl -u myapp.service --since "14:00" --until "15:00"

# Output as JSON (for piping into jq)
journalctl -u myapp.service -o json | jq .

# Kernel messages (similar to dmesg)
journalctl -k

# Disk usage of the journal
journalctl --disk-usage

# Vacuum old logs to free space
sudo journalctl --vacuum-size=500M
sudo journalctl --vacuum-time=7d
```

### Dependencies: After, Requires, Wants

systemd handles service ordering and dependencies through three directives:

```ini
[Unit]
# Ordering: start myapp AFTER postgres is started
After=postgresql.service

# Hard dependency: if postgres cannot start, myapp should fail to start too
Requires=postgresql.service

# Soft dependency: try to start redis, but do not fail myapp if redis fails
Wants=redis.service
```

`After` controls **ordering** (when). `Requires` and `Wants` control **dependency**
(whether). You usually want both together:

```ini
After=postgresql.service
Requires=postgresql.service
```

This means: start after postgres, and fail if postgres is not available. Without `After`,
systemd starts both in parallel (but myapp still fails if postgres is not available).

### Socket activation

systemd can listen on a socket and start the service only when a connection arrives.
This means the service does not consume resources until needed, and systemd holds the
socket during service restarts so no connections are lost.

```ini
# /etc/systemd/system/myapp.socket
[Unit]
Description=My Application Socket

[Socket]
ListenStream=8080

[Install]
WantedBy=sockets.target
```

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application Server
Requires=myapp.socket

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/myapp/server.py
```

When you enable and start `myapp.socket`, systemd listens on port 8080. The first
connection triggers systemd to start `myapp.service`. The socket fd is passed to the
service process via the `LISTEN_FDS` environment variable (file descriptor 3). The
service reads from that fd instead of creating its own socket.

During a restart, systemd holds the socket open. Incoming connections queue in the
kernel's TCP backlog. When the new service instance starts, it picks up the queued
connections. Zero downtime restarts.

### Resource limits via cgroups

systemd automatically creates a cgroup for each service. You can set resource limits
directly in the unit file:

```ini
[Service]
# Memory limit: 512 MB hard limit
MemoryMax=512M

# Memory soft limit: start reclaiming at 256 MB
MemoryHigh=256M

# CPU: 150% = 1.5 cores maximum
CPUQuota=150%

# Max processes (prevents fork bombs)
TasksMax=100

# IO limits
IOReadBandwidthMax=/dev/sda 50M
IOWriteBandwidthMax=/dev/sda 20M
```

These directives map directly to the cgroup v2 controllers covered in Step 9. `MemoryMax`
writes to `memory.max`, `CPUQuota` writes to `cpu.max`, `TasksMax` writes to `pids.max`.
systemd is providing a declarative interface to the same kernel mechanisms.

### User units

You can run services as a regular user with `systemctl --user`. No root required.

```bash
# Create a user service directory
mkdir -p ~/.config/systemd/user/

# Create a user service
cat > ~/.config/systemd/user/dev-server.service << 'EOF'
[Unit]
Description=Development Server

[Service]
Type=simple
ExecStart=/usr/bin/python3 -m http.server 8080
WorkingDirectory=%h/projects
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

# Reload, enable, start
systemctl --user daemon-reload
systemctl --user enable --now dev-server.service
systemctl --user status dev-server.service

# View logs
journalctl --user -u dev-server.service -f

# To make user services run even when not logged in:
sudo loginctl enable-linger $USER
```

The `%h` in `WorkingDirectory=%h/projects` is a specifier that expands to the user's
home directory. systemd has several specifiers: `%h` (home), `%u` (username), `%t`
(runtime directory), `%n` (unit name).

### Timer units: systemd's alternative to cron

systemd timers are unit files that trigger other units on a schedule or at intervals.
They have advantages over cron: integrated logging via journalctl, dependency management,
persistent timers that catch up on missed runs, and the same resource limit controls as
services.

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily Backup Timer

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/backup.service
[Unit]
Description=Daily Backup

[Service]
Type=oneshot
ExecStart=/opt/scripts/backup.sh
```

- `OnCalendar=*-*-* 02:00:00` - run daily at 2am. The format is
  `year-month-day hour:minute:second`. Wildcards match any value.
- `Persistent=true` - if the machine was off at 2am, run the timer when it next boots.
- `RandomizedDelaySec=300` - add a random delay of 0-300 seconds to prevent thundering
  herd (many machines all backing up at exactly 2:00:00).

Common calendar expressions:

```
OnCalendar=hourly              # Every hour, on the hour
OnCalendar=daily               # Every day at midnight
OnCalendar=weekly              # Every Monday at midnight
OnCalendar=Mon *-*-* 09:00:00 # Every Monday at 9am
OnCalendar=*-*-* *:00/15:00   # Every 15 minutes
```

Monotonic timers (relative intervals, not wall-clock):

```ini
[Timer]
OnBootSec=5min           # 5 minutes after boot
OnUnitActiveSec=1h       # 1 hour after the service last ran
OnStartupSec=30s         # 30 seconds after systemd started
```

```bash
# List all active timers
systemctl list-timers

# Enable and start a timer
sudo systemctl enable --now backup.timer

# Trigger the associated service immediately (for testing)
sudo systemctl start backup.service
```

> **AGENTIC GROUNDING:** Timer units are how you schedule operational tasks around agent
> infrastructure: log rotation, backup verification, certificate renewal, health check
> sweeps, stale container cleanup. They are declarative, logged, and restartable. When
> an agent generates a systemd timer, verify: Does the OnCalendar expression match the
> intended schedule? Is Persistent=true set for tasks that must not be skipped? Is the
> associated service a `Type=oneshot`?

> **HISTORY:** systemd was released in 2010 by Lennart Poettering and Kay Sievers at
> Red Hat. It replaced SysV init (1983) and its shell-script based service management.
> The adoption was contentious. Opponents argued it violated Unix philosophy by combining
> init, logging, cron, and network management into one system. Proponents argued the
> old model's shell-script init was fragile, slow (sequential startup), and lacked
> features (no dependency management, no cgroup integration, no socket activation).
> Debian's adoption vote in 2014 was one of the most heated governance debates in open
> source history. Today systemd is the init system for all major Linux distributions
> except Alpine (which uses OpenRC), Void (runit), and Gentoo (choice of init systems).

---

## 3. cron - Time-Based Scheduling

*Estimated time: 25 minutes*

cron is the original Unix scheduler. It runs commands at specified times. It has been
doing this since 1979 with essentially the same syntax, making it one of the oldest
actively used Unix utilities.

### The crontab format

A crontab line has five time fields followed by a command:

```
# .---------------- minute (0-59)
# |  .------------- hour (0-23)
# |  |  .---------- day of month (1-31)
# |  |  |  .------- month (1-12 or jan-dec)
# |  |  |  |  .---- day of week (0-7, 0 and 7 are Sunday, or sun-sat)
# |  |  |  |  |
  *  *  *  *  *  command to execute
```

Examples:

```
# Every minute
* * * * * /opt/scripts/check-health.sh

# Every 5 minutes
*/5 * * * * /opt/scripts/poll-status.sh

# Every hour at minute 0
0 * * * * /opt/scripts/hourly-cleanup.sh

# Daily at 2:30am
30 2 * * * /opt/scripts/backup.sh

# Every Monday at 9am
0 9 * * 1 /opt/scripts/weekly-report.sh

# First day of every month at midnight
0 0 1 * * /opt/scripts/monthly-archive.sh

# Every weekday (Monday through Friday) at 8am
0 8 * * 1-5 /opt/scripts/morning-check.sh

# Every 15 minutes during business hours
*/15 8-17 * * 1-5 /opt/scripts/monitor.sh
```

### Special strings

```
@reboot    # Run once at startup
@yearly    # 0 0 1 1 *
@monthly   # 0 0 1 * *
@weekly    # 0 0 * * 0
@daily     # 0 0 * * *
@hourly    # 0 * * * *
```

### Managing crontabs

```bash
# Edit your crontab (opens $EDITOR)
crontab -e

# List your crontab
crontab -l

# Edit another user's crontab (requires root)
sudo crontab -u myapp -e

# Remove your crontab (dangerous - no confirmation)
crontab -r
```

### The environment problem

This is the single most common source of cron failures. cron runs with a **minimal
environment**. Your `PATH` likely includes `~/.local/bin`, `/usr/local/bin`, and other
directories. cron's `PATH` is typically just `/usr/bin:/bin`. Your `.bashrc` does not
run. Your shell aliases do not exist.

```bash
# What cron sees (approximately):
# PATH=/usr/bin:/bin
# HOME=/home/youruser
# SHELL=/bin/sh
# LOGNAME=youruser
# That is it. No DISPLAY, no LANG, no custom PATH entries.
```

Solutions:

```
# Option 1: Set PATH in the crontab
PATH=/usr/local/bin:/usr/bin:/bin:/home/myuser/.local/bin

# Option 2: Use absolute paths in commands
* * * * * /usr/local/bin/python3 /opt/scripts/check.py

# Option 3: Source your profile (fragile, not recommended)
* * * * * . /home/myuser/.profile && check.py
```

Option 2 is the most reliable. Always use absolute paths in cron.

### Output handling

By default, cron mails stdout and stderr to the user who owns the crontab. If no mail
system is configured (common on modern servers), the output is silently lost. If mail IS
configured, a cron job that produces output every minute generates 1440 emails per day.

```bash
# Redirect stdout and stderr to a log file
*/5 * * * * /opt/scripts/check.sh >> /var/log/mycheck.log 2>&1

# Discard all output (only if you truly do not care)
*/5 * * * * /opt/scripts/check.sh > /dev/null 2>&1

# Log stdout, email stderr (errors are mailed, normal output logged)
*/5 * * * * /opt/scripts/check.sh >> /var/log/mycheck.log 2> /tmp/mycheck-errors.log
```

### Preventing overlapping runs with flock

If a cron job takes longer than the interval, the next invocation starts while the
previous one is still running. For many tasks (database backups, report generation),
this is destructive.

`flock` is a file locking utility that prevents concurrent execution:

```bash
# Only run if not already running
*/5 * * * * flock -n /tmp/mycheck.lock /opt/scripts/check.sh

# Wait up to 60 seconds for the lock, then give up
*/5 * * * * flock -w 60 /tmp/mycheck.lock /opt/scripts/check.sh
```

`-n` means non-blocking: if the lock is held, exit immediately (skip this run).
`-w 60` means wait up to 60 seconds for the lock, then give up.

### System cron directories

In addition to per-user crontabs, most distributions have system-level cron directories:

```
/etc/cron.d/         # Drop-in crontab files (any schedule)
/etc/cron.daily/     # Scripts run daily
/etc/cron.hourly/    # Scripts run hourly
/etc/cron.weekly/    # Scripts run weekly
/etc/cron.monthly/   # Scripts run monthly
```

Scripts in `cron.daily/`, `cron.hourly/`, etc. do not use crontab syntax. They are
executable scripts run by `anacron` or `run-parts`. Just drop in a script:

```bash
sudo cp /opt/scripts/cleanup.sh /etc/cron.daily/cleanup
sudo chmod +x /etc/cron.daily/cleanup
# This script runs daily (exact time depends on the system configuration)
```

### cron gotchas

| Gotcha | Consequence | Fix |
|--------|-------------|-----|
| Minimal `PATH` | Commands not found | Use absolute paths or set `PATH` in crontab |
| Timezone | Usually UTC on servers | Check with `timedatectl`, set `CRON_TZ` if supported |
| Overlapping runs | Data corruption, resource exhaustion | Use `flock` |
| No output capture | Failures are silent | Redirect to log files |
| No dependency management | Cannot express "run after X" | Use systemd timers instead |
| `%` is special in crontab | Unescaped `%` becomes a newline | Escape: `\%` |

The `%` gotcha is particularly insidious. In a crontab entry, `%` is converted to a
newline, and everything after the first unescaped `%` is fed as stdin. This breaks
date formatting commands:

```bash
# BROKEN: % is interpreted by cron
0 2 * * * /opt/scripts/backup.sh --date $(date +%Y-%m-%d)

# FIXED: escape the percent signs
0 2 * * * /opt/scripts/backup.sh --date $(date +\%Y-\%m-\%d)

# BETTER: put the logic in the script, not in the crontab line
0 2 * * * /opt/scripts/backup.sh
```

### systemd timers vs cron

| Feature | cron | systemd timer |
|---------|------|---------------|
| Logging | Must redirect manually | journalctl built-in |
| Dependencies | None | Full systemd dependency graph |
| Persistent (catch up on missed runs) | No | `Persistent=true` |
| Resource limits | None | Full cgroup integration |
| Calendar expressions | 5 fields | More expressive (ranges, repeats) |
| Randomized delay | No (some implementations have `RANDOM_DELAY`) | `RandomizedDelaySec` |
| Compatibility | Every Unix since 1979 | Linux with systemd only |
| Simplicity | One line | Two files (timer + service) |

Use cron when: you need maximum portability, the task is simple, you are on a system
without systemd. Use systemd timers when: you want logging, dependency management,
resource limits, or persistent scheduling.

> **HISTORY:** cron dates to Version 7 Unix (1979). The modern implementation used on most
> Linux systems is Vixie cron, written by Paul Vixie in 1987. The crontab format - five
> fields for minute, hour, day, month, and day-of-week - has not changed in over 40 years.
> It may be the single longest-lived user interface in computing that is still in daily
> use worldwide.

---

## 4. supervisord - Process Manager for Containers

*Estimated time: 20 minutes*

supervisord is a Python-based process manager. It runs multiple processes under a single
supervisor daemon, automatically restarts them on crash, manages logs, and provides a
control interface. It occupies a middle ground: more capable than a shell script, simpler
than systemd, and designed for environments (like containers) where systemd is not
available or appropriate.

### When to use supervisord

systemd is not typically available inside containers. Containers are designed around the
one-process-per-container model: one entrypoint, one responsibility. But sometimes you
genuinely need multiple processes in a single container: a web server and a log shipper,
or (as in the midget container) a virtual display, a window manager, and the agent process.

Options for multi-process containers:

1. **Shell script as PID 1** - background processes with `&`, wait on the main one. This is
   what the midget entrypoint does. Simple but fragile: no restart on crash, no health checks.
2. **supervisord as PID 1** - manages all processes, restarts crashes, rotates logs.
   More robust, more configuration.
3. **tini as PID 1 + shell script** - tini handles signals and zombie reaping, the shell
   script manages processes. Middle ground.
4. **Multiple containers** - one process per container, orchestrated by Docker Compose or
   Kubernetes. The "proper" solution but adds orchestration complexity.

### Configuration

```ini
# /etc/supervisord.conf (or wherever you put it)

[supervisord]
nodaemon=true              ; run in foreground (required when PID 1 in container)
user=root                  ; run supervisord as root (children can drop privileges)
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:xvfb]
command=Xvfb :99 -screen 0 1280x720x24 -ac
autorestart=true           ; restart if it crashes
startretries=3             ; try 3 times before giving up
priority=100               ; start order (lower = first)
stdout_logfile=/var/log/xvfb.log
stderr_logfile=/var/log/xvfb-error.log

[program:fluxbox]
command=fluxbox -display :99
autorestart=true
startretries=3
priority=200               ; starts after xvfb (priority 100)
stdout_logfile=/var/log/fluxbox.log
stderr_logfile=/var/log/fluxbox-error.log
depends_on=xvfb            ; conceptual, not actually a supervisord directive

[program:agent]
command=python3 /opt/agent/main.py
autorestart=unexpected     ; restart only on non-zero exit codes
startsecs=5                ; must run 5 seconds to count as "started"
stopwaitsecs=30            ; give 30 seconds for graceful shutdown
stopsignal=TERM            ; send SIGTERM to stop
priority=300               ; starts last
stdout_logfile=/dev/stdout ; write to container stdout (for docker logs)
stdout_logfile_maxbytes=0  ; no rotation (let docker handle it)
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=DISPLAY=":99",HOME="/home/agent"
user=agent                 ; run as non-root user
```

Key directives:

- `nodaemon=true` - critical for containers. Without this, supervisord forks into the
  background and the container's PID 1 exits (killing the container).
- `autorestart=true` - always restart. `unexpected` restarts only on non-zero exit
  codes (exit 0 means intentional stop).
- `startsecs` - how long the process must run to be considered started. Prevents restart
  loops where the process crashes immediately.
- `priority` - start order. Lower numbers start first. This replaces the dependency
  ordering that systemd provides with `After`.
- `stopwaitsecs` - how long to wait after sending `stopsignal` before escalating to
  SIGKILL. Equivalent to Docker's stop timeout.
- `stdout_logfile=/dev/stdout` - in containers, writing to `/dev/stdout` makes the output
  appear in `docker logs`. This follows the 12-factor app principle.

### supervisorctl

```bash
# Check status of all programs
supervisorctl status

# Start/stop/restart a specific program
supervisorctl start agent
supervisorctl stop agent
supervisorctl restart agent

# Restart all programs
supervisorctl restart all

# Read recent log output
supervisorctl tail -f agent

# Reload configuration after editing supervisord.conf
supervisorctl reread
supervisorctl update
```

### Dockerfile pattern

```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    supervisor python3 xvfb fluxbox \
    && rm -rf /var/lib/apt/lists/*

COPY supervisord.conf /etc/supervisord.conf
COPY app/ /opt/app/

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

> **AGENTIC GROUNDING:** The midget entrypoint.sh is equivalent to a minimal, hand-rolled
> supervisord: it starts Xvfb and fluxbox in the background, then exec's the target
> process. The difference: if Xvfb crashes, the entrypoint does not restart it. If the
> agent hangs, nothing kills it. supervisord adds automatic restart, configurable
> timeouts, and log management. When evaluating whether to upgrade from a shell script
> to supervisord, the question is: does the failure mode of a crashed background process
> justify the added complexity? For a development container, probably not. For a
> production agent sandbox running for hours, probably yes.

---

## 5. Process Supervision Patterns

*Estimated time: 25 minutes*

The tools (systemd, cron, supervisord) implement patterns. The patterns are more
important than the tools. You can apply them with bash, Python, or any language that
can fork, exec, and handle signals.

### Crash-only software

Design your process to crash cleanly and restart quickly. Do not try to recover from
every possible error state within the process. Instead:

- Write state to durable storage (disk, database) at meaningful checkpoints
- On startup, read the last checkpoint and resume
- Let the supervisor handle the restart

This is the Netflix approach (Chaos Engineering): design for failure, not prevention of
failure. If your process can restart cleanly in under a second, a crash is not an outage
- it is a restart.

```python
#!/usr/bin/env python3
"""Crash-only agent: writes checkpoints, resumes on restart."""
import json
import signal
import sys
import time
from pathlib import Path

STATE_FILE = Path("/var/lib/agent/state.json")

def load_state():
  """Resume from last checkpoint or start fresh."""
  if STATE_FILE.exists():
    return json.loads(STATE_FILE.read_text())
  return {"task_index": 0, "results": []}

def save_state(state):
  """Atomic write: write to temp, then rename."""
  tmp = STATE_FILE.with_suffix(".tmp")
  tmp.write_text(json.dumps(state))
  tmp.rename(STATE_FILE)  # atomic on the same filesystem

def main():
  state = load_state()
  tasks = ["task_a", "task_b", "task_c", "task_d"]

  for i in range(state["task_index"], len(tasks)):
    task = tasks[i]
    print(f"Processing {task}", flush=True)
    # Simulate work
    time.sleep(2)
    state["task_index"] = i + 1
    state["results"].append(f"{task}: done")
    save_state(state)

  print("All tasks complete", flush=True)

if __name__ == "__main__":
  main()
```

If this process is killed after completing task_b, it restarts at task_c. The supervisor
handles the restart; the process handles the state.

### Watchdog pattern

An external process monitors the target and restarts it on failure. This is supervision
from outside - the monitor is independent of the monitored process, so a hang in the
target does not affect the monitor.

systemd has built-in watchdog support:

```ini
[Service]
Type=notify
WatchdogSec=30
# The service must call sd_notify("WATCHDOG=1") at least every 30 seconds
# If it does not, systemd kills and restarts it
```

The service must actively signal that it is alive. If it hangs (deadlock, infinite loop,
stuck I/O), the watchdog timer expires and systemd restarts it. This catches failures
that a simple "is the process running?" check misses.

### Heartbeat pattern

Similar to the watchdog, but the heartbeat mechanism is application-defined. The
supervised process periodically writes a timestamp to a file or touches a file. The
supervisor checks the timestamp. If it is too old, the process is considered hung.

```bash
#!/bin/bash
# heartbeat-monitor.sh
# Watches a heartbeat file and restarts the process if stale

HEARTBEAT_FILE="/var/run/agent/heartbeat"
MAX_AGE=60  # seconds
PID_FILE="/var/run/agent/pid"
CMD="/opt/agent/run.sh"

while true; do
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    # Process is running - check heartbeat
    if [ -f "$HEARTBEAT_FILE" ]; then
      last_beat=$(stat -c %Y "$HEARTBEAT_FILE")
      now=$(date +%s)
      age=$((now - last_beat))
      if [ "$age" -gt "$MAX_AGE" ]; then
        printf 'Heartbeat stale (%d seconds). Killing process.\n' "$age"
        kill "$(cat "$PID_FILE")"
        sleep 2
        kill -9 "$(cat "$PID_FILE")" 2>/dev/null
      fi
    fi
  else
    # Process not running - start it
    printf 'Starting process.\n'
    $CMD &
    printf '%d' $! > "$PID_FILE"
  fi
  sleep 5
done
```

The monitored process writes its heartbeat:

```python
from pathlib import Path
import time

HEARTBEAT = Path("/var/run/agent/heartbeat")

def heartbeat():
  """Touch the heartbeat file to signal liveness."""
  HEARTBEAT.touch()

# In the main loop:
while True:
  do_work()
  heartbeat()
```

### Graceful shutdown

When a supervisor sends SIGTERM, the process should:

1. Stop accepting new work
2. Finish the current in-progress task (within a reasonable timeout)
3. Write state to disk
4. Exit 0

```python
#!/usr/bin/env python3
"""Graceful shutdown: finishes current work before exiting."""
import signal
import sys
import time

shutdown_requested = False

def handle_sigterm(signum, frame):
  global shutdown_requested
  print("SIGTERM received. Finishing current task...", flush=True)
  shutdown_requested = True

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)

def simulate_task(name, duration):
  """Simulate a task that takes time."""
  print(f"Starting task: {name} (will take {duration}s)", flush=True)
  for i in range(duration):
    time.sleep(1)
    if shutdown_requested and i < duration - 1:
      # Continue the current task even during shutdown
      print(f"  Shutdown requested, but finishing {name}... ({i+1}/{duration})", flush=True)
  print(f"Completed task: {name}", flush=True)

tasks = [("backup-db", 5), ("compress-logs", 3), ("send-report", 4)]

for task_name, duration in tasks:
  if shutdown_requested:
    print("Shutdown: skipping remaining tasks.", flush=True)
    break
  simulate_task(task_name, duration)

print("Clean exit.", flush=True)
sys.exit(0)
```

When this process receives SIGTERM during "backup-db" (which takes 5 seconds), it
finishes the backup, then skips "compress-logs" and "send-report", and exits cleanly.
The supervisor sees exit 0 and does not restart (if `Restart=on-failure`). The data is
consistent.

### Pre-stop hooks

Run cleanup before the process exits. systemd supports this:

```ini
[Service]
ExecStart=/opt/myapp/server
ExecStop=/opt/myapp/pre-stop.sh
# systemd runs pre-stop.sh, THEN sends SIGTERM to the main process
```

Docker Compose equivalent:

```yaml
services:
  myapp:
    image: myapp:latest
    stop_signal: SIGTERM
    stop_grace_period: 30s
```

Kubernetes provides `preStop` hooks and a configurable `terminationGracePeriodSeconds`:

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/opt/scripts/pre-stop.sh"]
terminationGracePeriodSeconds: 30
```

### Health checks

A process can be running (PID exists) but not functioning (deadlocked, out of memory,
stuck on I/O). Health checks verify that the process is actually serving its purpose.

**Docker HEALTHCHECK:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8080/health || exit 1
```

- `--interval=30s` - check every 30 seconds
- `--timeout=5s` - if the check takes longer than 5 seconds, it fails
- `--retries=3` - the container is marked unhealthy after 3 consecutive failures
- `--start-period=10s` - give the process 10 seconds to start before counting failures

**systemd watchdog** (covered above):

```ini
[Service]
WatchdogSec=30
# Process must call sd_notify("WATCHDOG=1") every 30 seconds
```

**Application-level health endpoint:**

```python
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class HealthHandler(BaseHTTPRequestHandler):
  def do_GET(self):
    if self.path == "/health":
      # Check actual health: database connection, memory, queue depth, etc.
      if is_healthy():
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')
      else:
        self.send_response(503)
        self.end_headers()
        self.wfile.write(b'{"status":"unhealthy"}')

def start_health_server(port=8081):
  server = HTTPServer(("0.0.0.0", port), HealthHandler)
  thread = threading.Thread(target=server.serve_forever, daemon=True)
  thread.start()
```

> **AGENTIC GROUNDING:** When an agent calls an LLM API and the call hangs (network
> timeout, provider outage), the agent process is running but not progressing. A PID check
> says "alive." A health check that verifies recent task completion says "stuck." The
> watchdog/heartbeat pattern catches this: if the agent has not completed a task or updated
> its heartbeat in 5 minutes, the supervisor kills and restarts it. Container orchestration
> (Kubernetes liveness probes, Docker HEALTHCHECK) builds on these exact primitives.

---

## 6. Logging for Supervised Processes

*Estimated time: 15 minutes*

Supervised processes produce logs. How those logs are captured, stored, and accessed
depends on the supervision layer.

### The 12-factor principle

The Twelve-Factor App methodology (Heroku, 2011) states: "A twelve-factor app never
concerns itself with routing or storage of its output stream." The application writes
to stdout. The environment handles the rest.

This is the correct approach for supervised processes:

- In systemd: stdout goes to journald automatically. `journalctl -u myservice` reads it.
- In Docker: stdout goes to the Docker logging driver. `docker logs mycontainer` reads it.
- In supervisord: stdout goes to the configured `stdout_logfile`. Set it to `/dev/stdout`
  in containers to chain into Docker's logging.
- In Kubernetes: stdout goes to the node's container runtime log. `kubectl logs pod` reads
  it.

At every layer, the convention is the same: write to stdout. The supervisor captures it.

### journalctl for systemd services

systemd's journal is binary, indexed, and searchable. It captures structured metadata
alongside the log text: timestamp, unit name, PID, UID, priority, hostname.

```bash
# Follow a service's logs in real time
journalctl -u myapp.service -f

# Filter by priority (error and above)
journalctl -u myapp.service -p err

# Show entries with specific fields
journalctl _SYSTEMD_UNIT=myapp.service _PID=12345

# Output as JSON for programmatic processing
journalctl -u myapp.service -o json-pretty | head -20

# Export for external systems
journalctl -u myapp.service --since "1 hour ago" -o json > /tmp/logs.json
```

### Structured logging

For agent processes, structured logging (JSON lines to stdout) is strongly recommended:

```python
import json
import sys
import time

def log(level, message, **fields):
  entry = {
    "ts": time.time(),
    "level": level,
    "msg": message,
    **fields
  }
  print(json.dumps(entry), flush=True)

# Usage:
log("info", "Task started", task_id="abc-123", task_type="api_call")
log("error", "API timeout", task_id="abc-123", duration_ms=30000, endpoint="/v1/complete")
log("info", "Task retrying", task_id="abc-123", attempt=2)
```

Output:

```
{"ts": 1741616400.123, "level": "info", "msg": "Task started", "task_id": "abc-123", "task_type": "api_call"}
{"ts": 1741616430.456, "level": "error", "msg": "API timeout", "task_id": "abc-123", "duration_ms": 30000, "endpoint": "/v1/complete"}
{"ts": 1741616431.789, "level": "info", "msg": "Task retrying", "task_id": "abc-123", "attempt": 2}
```

Each line is valid JSON. You can pipe it through `jq` to filter, aggregate, and format:

```bash
# Show only errors
docker logs mycontainer 2>&1 | jq -r 'select(.level == "error") | .msg'

# Show all entries for a specific task
docker logs mycontainer 2>&1 | jq 'select(.task_id == "abc-123")'

# Count events by level
docker logs mycontainer 2>&1 | jq -r '.level' | sort | uniq -c
```

### Log rotation

Logs grow. Without rotation, they fill the disk.

**journald** handles rotation automatically based on configuration in
`/etc/systemd/journald.conf`:

```ini
[Journal]
SystemMaxUse=500M    # max disk usage for system journal
SystemMaxFileSize=50M
MaxRetentionSec=30d  # keep logs for 30 days
```

**logrotate** handles file-based logs (for processes that write to files):

```
# /etc/logrotate.d/myapp
/var/log/myapp/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload myapp.service
    endscript
}
```

**Docker** has its own log rotation. Without configuration, container logs grow unbounded.
Configure in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```

Or per-container:

```bash
docker run --log-opt max-size=50m --log-opt max-file=3 myimage
```

> **AGENTIC GROUNDING:** An agent that runs for 8 hours generating continuous log output
> (tool invocations, API calls, screenshots, decisions) can produce gigabytes of logs.
> Without rotation or size limits, the disk fills and the container crashes with ENOSPC
> (no space left on device). This is a silent failure mode: the agent stops working not
> because of a bug but because of unbounded log growth. Configure log rotation before
> deploying long-running agents.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

---

### Challenge: Write a systemd User Service

*Estimated time: 15 minutes*

Create a user-level systemd service that runs a Python HTTP server. Verify it starts on
boot, auto-restarts on crash, and produces accessible logs.

**Step 1: Create the service file**

```bash
mkdir -p ~/.config/systemd/user/

cat > ~/.config/systemd/user/bootcamp-http.service << 'EOF'
[Unit]
Description=Bootcamp HTTP Server

[Service]
Type=simple
ExecStart=/usr/bin/python3 -m http.server 9876
WorkingDirectory=%h
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
```

**Step 2: Enable and start**

```bash
systemctl --user daemon-reload
systemctl --user enable --now bootcamp-http.service
systemctl --user status bootcamp-http.service
```

**Step 3: Verify it is serving**

```bash
curl -s http://localhost:9876/ | head -5
```

**Step 4: Simulate a crash**

```bash
# Find the PID
PID=$(systemctl --user show bootcamp-http.service --property=MainPID --value)
printf 'Current PID: %s\n' "$PID"

# Kill it with SIGKILL (unclean crash)
kill -9 "$PID"

# Wait for systemd to restart it (RestartSec=3)
sleep 5

# Check status - should be active again with a new PID
systemctl --user status bootcamp-http.service
NEW_PID=$(systemctl --user show bootcamp-http.service --property=MainPID --value)
printf 'New PID: %s\n' "$NEW_PID"

# Verify the PIDs are different
[ "$PID" != "$NEW_PID" ] && printf 'Restart confirmed.\n'
```

**Step 5: Check the logs**

```bash
journalctl --user -u bootcamp-http.service --since "5 minutes ago"
# You should see: the original start, the crash, and the restart
```

**Step 6: Cleanup**

```bash
systemctl --user disable --now bootcamp-http.service
rm ~/.config/systemd/user/bootcamp-http.service
systemctl --user daemon-reload
```

**Verification criteria:**
- [ ] Service starts and serves HTTP on port 9876
- [ ] `systemctl --user status` shows it as active
- [ ] After `kill -9`, the service restarts automatically within ~3 seconds
- [ ] `journalctl --user -u bootcamp-http.service` shows the crash and restart
- [ ] The PID changes after the restart

---

### Challenge: The PID 1 Experiment

*Estimated time: 15 minutes*

Demonstrate the PID 1 signal-swallowing problem in containers and fix it.

**Part A: The broken version**

Create a script that does NOT use `exec`:

```bash
mkdir -p /tmp/pid1-test

cat > /tmp/pid1-test/broken-entrypoint.sh << 'SCRIPT'
#!/bin/bash
echo "Shell is PID $$"
# Run the target as a CHILD process (no exec)
python3 -c "
import signal, time, sys
def handler(sig, frame):
    print('Python received SIGTERM!', flush=True)
    sys.exit(0)
signal.signal(signal.SIGTERM, handler)
print(f'Python is PID {__import__(\"os\").getpid()}', flush=True)
while True:
    time.sleep(1)
"
SCRIPT
chmod +x /tmp/pid1-test/broken-entrypoint.sh

cat > /tmp/pid1-test/Dockerfile << 'DOCKER'
FROM python:3-slim
COPY broken-entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
DOCKER
```

Build and run:

```bash
docker build -t pid1-broken /tmp/pid1-test
docker run -d --name pid1-broken pid1-broken
sleep 2
docker logs pid1-broken
# Shell is PID 1
# Python is PID 7 (or similar - NOT PID 1)
```

Now stop it and time how long it takes:

```bash
time docker stop pid1-broken
# This will take ~10 seconds (Docker's default stop timeout)
# because SIGTERM goes to the shell (PID 1), which ignores it
# Docker waits, then sends SIGKILL

docker logs pid1-broken
# Notice: "Python received SIGTERM!" does NOT appear
```

**Part B: Fix with exec**

```bash
cat > /tmp/pid1-test/fixed-entrypoint.sh << 'SCRIPT'
#!/bin/bash
echo "Shell is PID $$"
# Replace the shell with the target process
exec python3 -c "
import signal, time, sys
def handler(sig, frame):
    print('Python received SIGTERM!', flush=True)
    sys.exit(0)
signal.signal(signal.SIGTERM, handler)
print(f'Python is PID {__import__(\"os\").getpid()}', flush=True)
while True:
    time.sleep(1)
"
SCRIPT
chmod +x /tmp/pid1-test/fixed-entrypoint.sh

cat > /tmp/pid1-test/Dockerfile << 'DOCKER'
FROM python:3-slim
COPY fixed-entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
DOCKER

docker build -t pid1-fixed /tmp/pid1-test
docker run -d --name pid1-fixed pid1-fixed
sleep 2
docker logs pid1-fixed
# Shell is PID 1
# Python is PID 1 (replaced the shell!)

time docker stop pid1-fixed
# This returns immediately (< 1 second)
# Python received SIGTERM and exited cleanly

docker logs pid1-fixed
# "Python received SIGTERM!" appears
```

**Part C: Fix with tini**

```bash
docker rm -f pid1-broken 2>/dev/null

docker run -d --init --name pid1-tini pid1-broken
sleep 2
docker logs pid1-tini
# Shell is PID 1 (tini is actually PID 1, but shell thinks it is)
# Actually, tini is PID 1, shell is PID 2, python is PID 7

time docker stop pid1-tini
# tini forwards SIGTERM to the shell, shell terminates, children get SIGTERM
```

**Cleanup:**

```bash
docker rm -f pid1-broken pid1-fixed pid1-tini 2>/dev/null
rm -rf /tmp/pid1-test
```

**Verification criteria:**
- [ ] Without `exec`, `docker stop` takes ~10 seconds (SIGTERM ignored, SIGKILL after timeout)
- [ ] With `exec`, `docker stop` returns in under 1 second
- [ ] With `exec`, the Python SIGTERM handler fires ("Python received SIGTERM!" in logs)
- [ ] With `--init` (tini), the container stops cleanly

---

### Challenge: Cron with flock

*Estimated time: 10 minutes*

Write a cron job that runs every minute but takes variable time. Use `flock` to prevent
overlapping runs.

**Step 1: Create the simulated job**

```bash
cat > /tmp/slow-job.sh << 'SCRIPT'
#!/bin/bash
DURATION=$((RANDOM % 120 + 10))  # 10-129 seconds
printf '%s: Job starting (will take %d seconds)\n' "$(date +%H:%M:%S)" "$DURATION" \
  >> /tmp/slow-job.log
sleep "$DURATION"
printf '%s: Job completed\n' "$(date +%H:%M:%S)" >> /tmp/slow-job.log
SCRIPT
chmod +x /tmp/slow-job.sh
```

**Step 2: Add to crontab with flock**

```bash
# Add the cron entry
(crontab -l 2>/dev/null; printf '* * * * * flock -n /tmp/slow-job.lock /tmp/slow-job.sh\n') | crontab -

# Verify
crontab -l
```

**Step 3: Wait a few minutes and observe**

```bash
# After 3-4 minutes, check the log
cat /tmp/slow-job.log
# You should see that only one instance runs at a time
# If the first job takes 2 minutes, the second invocation is skipped (flock -n)

# Verify no overlapping processes
ps aux | grep slow-job
# At most one instance
```

**Step 4: Cleanup**

```bash
crontab -l | grep -v slow-job | crontab -
rm -f /tmp/slow-job.sh /tmp/slow-job.log /tmp/slow-job.lock
```

**Verification criteria:**
- [ ] The cron job runs every minute
- [ ] `flock -n` prevents overlapping runs (check log timestamps: no overlapping start/end)
- [ ] `ps` shows at most one instance of slow-job.sh

---

### Challenge: Supervisord in a Container

*Estimated time: 15 minutes*

Create a Docker container that uses supervisord to manage two processes. Verify
auto-restart on crash.

**Step 1: Create the files**

```bash
mkdir -p /tmp/supervisord-test

cat > /tmp/supervisord-test/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:httpserver]
command=python3 -m http.server 8080
directory=/tmp
autorestart=true
startretries=5
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:ticker]
command=bash -c "while true; do date >> /tmp/ticker.log; sleep 5; done"
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[supervisorctl]
EOF

cat > /tmp/supervisord-test/Dockerfile << 'DOCKER'
FROM python:3-slim
RUN apt-get update && apt-get install -y supervisor procps && rm -rf /var/lib/apt/lists/*
COPY supervisord.conf /etc/supervisord.conf
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
DOCKER
```

**Step 2: Build and run**

```bash
docker build -t sv-test /tmp/supervisord-test
docker run -d --name sv-test sv-test
sleep 3
```

**Step 3: Verify both processes are running**

```bash
docker exec sv-test supervisorctl status
# httpserver    RUNNING   pid 8, uptime 0:00:03
# ticker        RUNNING   pid 9, uptime 0:00:03
```

**Step 4: Kill one process and watch supervisord restart it**

```bash
# Get the httpserver PID
docker exec sv-test supervisorctl pid httpserver
# e.g., 8

# Kill it
docker exec sv-test kill -9 $(docker exec sv-test supervisorctl pid httpserver)

# Wait and check
sleep 3
docker exec sv-test supervisorctl status
# httpserver should be RUNNING again with a new PID
```

**Step 5: Check the ticker is still writing**

```bash
docker exec sv-test cat /tmp/ticker.log
# Should show timestamps every 5 seconds, uninterrupted
```

**Step 6: Cleanup**

```bash
docker rm -f sv-test
rm -rf /tmp/supervisord-test
```

**Verification criteria:**
- [ ] Both processes start and show RUNNING in `supervisorctl status`
- [ ] After killing httpserver, supervisord restarts it automatically
- [ ] The ticker process continues uninterrupted while httpserver restarts
- [ ] `docker logs sv-test` shows supervisord log output

---

### Challenge: Graceful Shutdown Handler

*Estimated time: 15 minutes*

Write a Python agent simulator that handles SIGTERM gracefully: finishes the current
task, writes state, and exits cleanly.

**Step 1: Create the agent simulator**

```bash
cat > /tmp/graceful-agent.py << 'PYTHON'
#!/usr/bin/env python3
"""Agent simulator with graceful shutdown."""
import json
import signal
import sys
import time
from pathlib import Path

STATE_FILE = Path("/tmp/agent-state.json")
shutdown_requested = False

def handle_sigterm(signum, frame):
    global shutdown_requested
    print("SIGTERM received. Will finish current task then exit.", flush=True)
    shutdown_requested = True

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)

def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"completed": [], "in_progress": None}

def save_state(state):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.rename(STATE_FILE)

def do_task(name, duration):
    """Simulate a task that takes time."""
    print(f"[TASK] Starting: {name} ({duration}s)", flush=True)
    for second in range(duration):
        time.sleep(1)
        if shutdown_requested:
            print(f"[TASK] Shutdown requested during {name} - finishing ({second+1}/{duration}s)", flush=True)
    print(f"[TASK] Completed: {name}", flush=True)
    return True

state = load_state()
tasks = [
    ("fetch-data", 3),
    ("process-batch", 5),
    ("generate-report", 4),
    ("send-results", 2),
    ("cleanup", 1),
]

for task_name, duration in tasks:
    if task_name in state["completed"]:
        print(f"[SKIP] Already done: {task_name}", flush=True)
        continue

    if shutdown_requested:
        print(f"[SKIP] Shutdown - not starting: {task_name}", flush=True)
        continue

    state["in_progress"] = task_name
    save_state(state)

    do_task(task_name, duration)

    state["completed"].append(task_name)
    state["in_progress"] = None
    save_state(state)

if shutdown_requested:
    print("[EXIT] Graceful shutdown complete. State saved.", flush=True)
else:
    print("[EXIT] All tasks complete.", flush=True)

# Clean up state file if all tasks done
if len(state["completed"]) == len(tasks):
    STATE_FILE.unlink(missing_ok=True)

sys.exit(0)
PYTHON
chmod +x /tmp/graceful-agent.py
```

**Step 2: Run and interrupt mid-task**

```bash
# Start the agent in the background
python3 /tmp/graceful-agent.py &
AGENT_PID=$!
printf 'Agent PID: %d\n' "$AGENT_PID"

# Wait until it is in the middle of a task (e.g., process-batch at ~6 seconds)
sleep 6

# Send SIGTERM
kill -TERM "$AGENT_PID"

# Wait for it to finish the current task and exit
wait "$AGENT_PID"
EXIT_CODE=$?
printf 'Exit code: %d\n' "$EXIT_CODE"
```

**Step 3: Verify the state file**

```bash
cat /tmp/agent-state.json
# Should show completed tasks and no in_progress
# e.g.: {"completed": ["fetch-data", "process-batch"], "in_progress": null}
```

**Step 4: Resume from checkpoint**

```bash
# Run again - it should skip completed tasks
python3 /tmp/graceful-agent.py
# Output should show [SKIP] for already-completed tasks
```

**Step 5: Cleanup**

```bash
rm -f /tmp/graceful-agent.py /tmp/agent-state.json
```

**Verification criteria:**
- [ ] The agent finishes the current task after receiving SIGTERM (does not abort mid-task)
- [ ] The agent does not start new tasks after SIGTERM
- [ ] The state file contains completed tasks and no in-progress task
- [ ] Exit code is 0 (clean exit)
- [ ] Re-running the agent skips already-completed tasks (resumes from checkpoint)

---

### Challenge: Build a Process Watchdog

*Estimated time: 20 minutes*

Write a bash script that monitors a process by PID, checks liveness every 5 seconds, and
restarts it if it dies or if a health check fails. This is supervision from first
principles - no systemd, no supervisord, just the process model from Step 1.

**Step 1: Create the service to monitor**

```bash
cat > /tmp/flaky-server.py << 'PYTHON'
#!/usr/bin/env python3
"""A deliberately flaky HTTP server for testing supervision."""
import random
import signal
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

crash_after = random.randint(15, 45)
start_time = time.time()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        elapsed = time.time() - start_time
        if self.path == "/health":
            if elapsed > crash_after:
                # Simulate degradation before crash
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b'{"status":"degraded"}')
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'hello')

    def log_message(self, format, *args):
        pass  # suppress per-request logging

def handle_term(sig, frame):
    print("Server shutting down", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_term)

print(f"Server starting (will degrade after {crash_after}s)", flush=True)
server = HTTPServer(("0.0.0.0", 9999), Handler)

try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
PYTHON
chmod +x /tmp/flaky-server.py
```

**Step 2: Create the watchdog**

```bash
cat > /tmp/watchdog.sh << 'WATCHDOG'
#!/bin/bash
# Process watchdog with health checking
# Usage: ./watchdog.sh

SERVER_CMD="python3 /tmp/flaky-server.py"
HEALTH_URL="http://localhost:9999/health"
CHECK_INTERVAL=5
HEALTH_TIMEOUT=3
MAX_HEALTH_FAILURES=2
PID_FILE="/tmp/watchdog-server.pid"
LOG="/tmp/watchdog.log"

health_failures=0
restarts=0

start_server() {
  $SERVER_CMD &
  local pid=$!
  printf '%d' "$pid" > "$PID_FILE"
  restarts=$((restarts + 1))
  health_failures=0
  printf '%s: Started server (PID=%d, restart #%d)\n' \
    "$(date +%H:%M:%S)" "$pid" "$restarts" >> "$LOG"
  printf 'Started server PID=%d\n' "$pid"
  sleep 2  # give it time to bind the port
}

stop_server() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null
      # Wait up to 5 seconds for graceful shutdown
      for i in 1 2 3 4 5; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      # Force kill if still running
      kill -9 "$pid" 2>/dev/null
    fi
    rm -f "$PID_FILE"
  fi
}

check_health() {
  local status
  status=$(curl -sf --max-time "$HEALTH_TIMEOUT" "$HEALTH_URL" 2>/dev/null)
  if [ $? -ne 0 ]; then
    return 1
  fi
  # Check if the response indicates healthy
  printf '%s' "$status" | grep -q '"ok"'
  return $?
}

cleanup() {
  printf '\nWatchdog shutting down.\n'
  stop_server
  exit 0
}

trap cleanup SIGTERM SIGINT

# Initial start
printf '' > "$LOG"
start_server

# Main watchdog loop
while true; do
  sleep "$CHECK_INTERVAL"

  pid=$(cat "$PID_FILE" 2>/dev/null)

  # Check if process is alive
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    printf '%s: Process died. Restarting.\n' "$(date +%H:%M:%S)" >> "$LOG"
    printf 'Process died. Restarting.\n'
    start_server
    continue
  fi

  # Check health endpoint
  if check_health; then
    health_failures=0
  else
    health_failures=$((health_failures + 1))
    printf '%s: Health check failed (%d/%d)\n' \
      "$(date +%H:%M:%S)" "$health_failures" "$MAX_HEALTH_FAILURES" >> "$LOG"
    printf 'Health check failed (%d/%d)\n' "$health_failures" "$MAX_HEALTH_FAILURES"

    if [ "$health_failures" -ge "$MAX_HEALTH_FAILURES" ]; then
      printf '%s: Max health failures reached. Restarting.\n' \
        "$(date +%H:%M:%S)" >> "$LOG"
      printf 'Max health failures. Restarting.\n'
      stop_server
      start_server
    fi
  fi
done
WATCHDOG
chmod +x /tmp/watchdog.sh
```

**Step 3: Run the watchdog**

```bash
/tmp/watchdog.sh &
WATCHDOG_PID=$!
printf 'Watchdog PID: %d\n' "$WATCHDOG_PID"

# Let it run for a minute or two - the flaky server will degrade
# and the watchdog will restart it
sleep 90

# Check the watchdog log
cat /tmp/watchdog.log
```

**Step 4: Test manual kill recovery**

```bash
# Kill the server directly
SERVER_PID=$(cat /tmp/watchdog-server.pid)
kill -9 "$SERVER_PID"

# Wait for the watchdog to notice (within CHECK_INTERVAL seconds)
sleep 10

# The watchdog should have restarted the server
cat /tmp/watchdog.log | tail -5
curl -s http://localhost:9999/health
# Should return {"status":"ok"} (fresh server)
```

**Step 5: Cleanup**

```bash
kill "$WATCHDOG_PID" 2>/dev/null
wait "$WATCHDOG_PID" 2>/dev/null
rm -f /tmp/flaky-server.py /tmp/watchdog.sh /tmp/watchdog.log /tmp/watchdog-server.pid
```

**Verification criteria:**
- [ ] The watchdog starts the server and keeps it running
- [ ] When the server process dies (`kill -9`), the watchdog detects it and restarts within CHECK_INTERVAL
- [ ] When the health check returns 503, the watchdog restarts after MAX_HEALTH_FAILURES consecutive failures
- [ ] The watchdog log shows restart events with timestamps
- [ ] Sending SIGTERM to the watchdog cleanly shuts down both the watchdog and the server

---

## Key Takeaways

Before moving on, verify you can answer these without looking anything up:

1. Why is PID 1 special? What three properties distinguish it from every other PID?

2. What happens when `docker stop` sends SIGTERM to a container whose PID 1 is a bash
   script that does not trap signals?

3. What does `exec "$@"` do in an entrypoint script, and why does it matter for signal
   delivery?

4. What is the difference between `Restart=on-failure` and `Restart=always` in a systemd
   unit?

5. What does `systemctl daemon-reload` do, and when must you run it?

6. Why does cron run with a minimal PATH, and what is the fix?

7. What does `flock -n` do, and why is it needed for cron jobs?

8. What is the difference between systemd timers and cron? When would you choose each?

9. What is the watchdog pattern, and what failure mode does it catch that a PID check
   does not?

10. What does "write logs to stdout" mean in practice, and why is it the convention for
    supervised processes?

---

## Recommended Reading

- **systemd documentation** - `man systemd.service`, `man systemd.unit`,
  `man systemd.timer`, `man systemd.exec`. The man pages are thorough and authoritative.
  `man systemd.directives` is an index of every directive across all unit file types.

- **"systemd for Developers"** - Lennart Poettering's blog series (three parts). Written
  by systemd's author, it explains the design rationale: why socket activation, why binary
  logs, why cgroup integration. Agree or disagree with systemd, but understand the
  reasoning.

- **The Twelve-Factor App** - https://12factor.net - Heroku's methodology for building
  software-as-a-service applications. Factor XI (Logs: treat logs as event streams) is
  directly relevant. The whole document is short and dense.

- **"Crash-Only Software"** - George Candea and Armando Fox (2003, HotOS IX). The original
  paper on designing software that only starts and crashes, with no graceful shutdown path.
  Counterintuitive but practical: if restart is fast and safe, you simplify the entire
  error handling model.

- **supervisord documentation** - http://supervisord.org - the official docs. Short,
  practical, covers every configuration directive.

- **"Avoiding PID 1 and Zombie Reaping"** - Thomas Orozco / Yelp Engineering blog.
  The definitive explanation of the PID 1 problem in containers. Motivated the creation
  of dumb-init.

> **HISTORY:** The idea of process supervision has a lineage. System V init (1983) was the
> first widely used Unix init system: shell scripts in `/etc/init.d/`, run sequentially,
> no dependency management. Dan Bernstein's daemontools (1997) pioneered the modern
> supervisor pattern: run processes in the foreground, let the supervisor handle
> daemonization, automatic restart on crash. daemontools influenced runit (Gerrit Pape,
> 2004), s6 (Laurent Bercot, 2014), and ultimately systemd's service management model.
> cron dates to Version 7 Unix (1979), written by Brian Kernighan. The crontab format -
> five fields, wildcards, ranges - has survived unchanged for over 45 years. supervisord
> (Chris McDonough, 2004) brought process supervision to Python and became the standard
> for managing multiple processes in early Docker containers before the one-process-per-
> container pattern became dominant.

---

## What to Read Next

[Step 12: Advanced Bash](/bootcamp/12-advanced-bash/) - trap, coprocesses, BASH_REMATCH, and the edges of shell
scripting. You now understand how supervisors manage processes, handle signals, and
schedule work. Step 12 goes deeper into the shell itself: `trap` for signal handling
in scripts (used in every graceful shutdown handler you saw here), coprocesses for
bidirectional communication between shell and subprocesses, `BASH_REMATCH` for regex
in pure bash, and the patterns at the boundary where shell scripting should hand off
to Python. The connection: the watchdog you built in the final challenge is a bash
supervision script. Step 12 gives you the tools to make it production-grade - proper
signal handling, robust error recovery, and the judgment to know when to rewrite it
in Python.
