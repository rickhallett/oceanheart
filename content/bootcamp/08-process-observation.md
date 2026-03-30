+++
title = "Process Observation - strace, ltrace, lsof, ss"
date = "2026-03-10"
description = "The Operator's instruments for observing what a process actually does at the syscall, file descriptor, and network level."
tags = ["strace", "ltrace", "lsof", "ss", "syscalls", "debugging", "observation", "bootcamp"]
step = 8
tier = 1
estimate = "3 hours"
bootcamp = 1
+++

Step 8 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model, file descriptors, signals), Step 3 (filesystem as state, /proc)
**Leads to:** Step 9 (container internals)

---

## Why This Step Exists

An agent claims "the server is running." An agent claims "I wrote the config file." An
agent claims "the database connection is working." How do you know?

You do not know. Not until you verify. And the tools in this step are how you verify.

These are the Operator's instruments for observing what a process is actually doing at the
syscall level, the file descriptor level, and the network level. The agent cannot run
strace on itself. The agent cannot inspect its own file descriptors from outside. The agent
cannot observe its own network connections from the kernel's perspective. You can. This
asymmetry is the reason this step exists.

The taxonomy's Principle 4 says "feedback is structural, not visual." The output of `strace`
is structural feedback - it shows you the exact sequence of kernel requests a process makes.
The output of `lsof` is structural feedback - it shows you the exact resources a process
holds open. The output of `ss` is structural feedback - it shows you the exact state of
every network socket on the system. None of these can be faked by a misbehaving process.
They come from the kernel, not from the process being observed.

This is the instrumentation layer for L12 verification. Everything you learn here composes
directly with Step 9 (containers are just processes with namespaces) and Step 10
(networking tools that generate the traffic these tools observe).

---

## Table of Contents

1. [System Calls: The Boundary](#1-system-calls-the-boundary) (~15 min)
2. [strace: System Call Tracer](#2-strace-system-call-tracer) (~60 min)
3. [ltrace: Library Call Tracer](#3-ltrace-library-call-tracer) (~15 min)
4. [lsof: List Open Files](#4-lsof-list-open-files) (~30 min)
5. [ss: Socket Statistics](#5-ss-socket-statistics) (~20 min)
6. [/proc/$PID as a Process Observatory](#6-procpid-as-a-process-observatory) (~15 min)
7. [Combining Tools for Diagnosis](#7-combining-tools-for-diagnosis) (~15 min)
8. [Quick Reference](#8-quick-reference)
9. [Challenges](#challenges) (~60 min)
10. [What to Read Next](#what-to-read-next)

---

## 1. System Calls: The Boundary

*Estimated time: 15 minutes*

Before you can observe a process, you need to understand what you are observing.

A **system call** (syscall) is a request from a userspace process to the kernel. Every
meaningful action a process takes - reading a file, writing to a socket, creating a child
process, allocating memory, checking the time - goes through a syscall. There is no other
path. A process cannot touch hardware, access another process's memory, or interact with
the network without asking the kernel to do it.

The boundary is architectural, not optional. The CPU enforces it. Userspace code runs in
a restricted mode (ring 3 on x86). Kernel code runs in a privileged mode (ring 0). A
syscall is a controlled transition from ring 3 to ring 0, through a gate the kernel
defines. The kernel validates the request, performs the operation, and returns the result.

This is why syscall tracing is so powerful. If you can see the syscalls, you can see
everything the process does that has any effect on the outside world. Internal computation
(arithmetic, string manipulation, data structure traversal) does not generate syscalls.
But the moment a process reads input, writes output, opens a file, connects to a server,
or spawns a child - there is a syscall, and strace can see it.

### The important syscall families

| Family | Examples | What they do |
|--------|----------|-------------|
| File I/O | `openat`, `read`, `write`, `close`, `stat`, `fstat` | Open, read, write, close, inspect files |
| Directory | `getdents64`, `mkdir`, `unlink`, `rename` | List, create, delete, rename directory entries |
| Process | `clone`, `execve`, `wait4`, `exit_group` | Create, replace, wait for, terminate processes |
| Memory | `mmap`, `mprotect`, `brk`, `munmap` | Map files into memory, adjust heap |
| Network | `socket`, `connect`, `bind`, `listen`, `accept`, `sendto`, `recvfrom` | Create sockets, establish connections |
| Signal | `rt_sigaction`, `rt_sigprocmask`, `kill`, `tgkill` | Install handlers, send signals |
| Time | `clock_gettime`, `clock_nanosleep`, `nanosleep` | Read clock, sleep |
| File descriptor | `dup2`, `fcntl`, `ioctl`, `pipe2` | Duplicate, configure, control fds |
| Polling | `poll`, `epoll_wait`, `select` | Wait for events on multiple fds |

Modern Linux has approximately 450 syscalls. You will encounter perhaps 30-40 routinely.
The rest are specialized. You do not need to memorize them - you need to know the pattern:
`syscall_name(arguments) = return_value`. strace shows you all of it.

> **HISTORY:** The syscall interface descends from the `trap` instruction on the PDP-11,
> which Ken Thompson and Dennis Ritchie used in the original Unix (1971). The concept is
> older - IBM's OS/360 had supervisor calls (SVCs) in the 1960s. But Unix made the
> interface small and regular: a handful of operations (open, read, write, close, fork,
> exec, wait, kill) that compose to build everything. The modern Linux syscall table is
> larger, but the design philosophy persists - small operations that compose.

---

## 2. strace: System Call Tracer

*Estimated time: 60 minutes*

strace intercepts and records every syscall a process makes. It is the single most useful
diagnostic tool on Linux. If you learn one tool from this step, learn strace.

### Basic usage: tracing a new process

```bash
# Trace all syscalls made by ls
strace ls /tmp
```

The output goes to stderr (so it does not mix with the program's stdout). Each line
shows one syscall:

```
execve("/usr/bin/ls", ["ls", "/tmp"], 0x7ffd... /* 50 vars */) = 0
brk(NULL)                               = 0x5645a2b3c000
openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
...
openat(AT_FDCWD, "/tmp", O_RDONLY|O_NONBLOCK|O_CLOEXEC|O_DIRECTORY) = 3
getdents64(3, 0x5645a2b5c150 /* 12 entries */, 32768) = 400
getdents64(3, 0x5645a2b5c150 /* 0 entries */, 32768) = 0
close(3)                                = 0
write(1, "file1.txt\nfile2.txt\n", 20)  = 20
close(1)                                = 0
exit_group(0)                           = ?
```

### Reading the output format

Every line follows the pattern:

```
syscall_name(arg1, arg2, ...) = return_value
```

- **syscall_name** - the kernel function being called
- **arguments** - the values passed in. Strings are shown quoted. Flags are shown as
  symbolic constants (e.g., `O_RDONLY|O_CLOEXEC`). Pointers are shown as hex addresses.
  Buffer contents are shown as strings (truncated by default).
- **return_value** - what the kernel returned. For most syscalls, 0 or a positive number
  means success. -1 means failure, followed by the errno name and description:

```
openat(AT_FDCWD, "/nonexistent", O_RDONLY) = -1 ENOENT (No such file or directory)
```

The errno tells you exactly why the call failed. `ENOENT` = file not found. `EACCES` =
permission denied. `ECONNREFUSED` = nothing listening on that port. `EAGAIN` = try again
(non-blocking operation had no data). These are not vague error messages - they are
specific kernel return codes.

### Attaching to a running process

```bash
# Trace an already-running process by PID
strace -p 1234

# Requires either root or same UID as the target process
# (controlled by /proc/sys/kernel/yama/ptrace_scope)
```

This is how you answer "what is this process doing right now?" without restarting it.
You attach, observe, and detach (Ctrl-C). The process continues running.

### Following children

```bash
# Follow forked child processes (essential for shell scripts and servers)
strace -f -p 1234

# Without -f, strace only traces the original process.
# A shell script forks for every external command. A web server
# forks or spawns threads for every request. Without -f, you see
# almost nothing useful.
```

Each child process gets a prefix showing its PID:

```
[pid  1234] read(0, ...
[pid  1235] write(1, ...
```

### Filtering by syscall category

The full strace output is overwhelming. Filter to what matters:

```bash
# Only file-related syscalls
strace -e trace=file ls /tmp
# Shows: openat, stat, access, readlink, unlink, rename, etc.

# Only network-related syscalls
strace -e trace=network curl https://example.com
# Shows: socket, connect, bind, listen, accept, sendto, recvfrom, etc.

# Only process-related syscalls
strace -e trace=process bash -c 'echo hello | cat'
# Shows: clone, execve, wait4, exit_group, etc.

# Only specific syscalls
strace -e trace=openat,read,write cat /etc/hostname
# Shows only those three syscalls
```

The trace categories are:

| Category | Syscalls included |
|----------|------------------|
| `file` | open, stat, chmod, chown, unlink, rename, readlink, etc. |
| `process` | fork, clone, execve, wait, exit, etc. |
| `network` | socket, connect, bind, listen, accept, send, recv, etc. |
| `signal` | sigaction, sigprocmask, kill, etc. |
| `ipc` | shmget, semget, msgget, etc. |
| `desc` | read, write, close, dup, select, poll, etc. |
| `memory` | mmap, mprotect, brk, etc. |

### Timing

```bash
# Timestamp each syscall (wall clock time)
strace -t ls /tmp
# 10:30:45 openat(AT_FDCWD, "/tmp", ...) = 3

# Microsecond timestamps
strace -tt ls /tmp
# 10:30:45.123456 openat(AT_FDCWD, "/tmp", ...) = 3

# Time spent IN each syscall (the time the kernel took)
strace -T ls /tmp
# openat(AT_FDCWD, "/tmp", ...) = 3 <0.000045>

# Summary statistics (no per-call output, just totals)
strace -c ls /tmp
# % time     seconds  usecs/call     calls    errors syscall
# ------ ----------- ----------- --------- --------- --------
#  30.00    0.000090          10         9           write
#  25.00    0.000075           5        15           openat
#  ...
```

`strace -c` is the quick answer to "where is this process spending its time?" If most
time is in `write`, the process is I/O bound. If most time is in `futex`, there is lock
contention. If most time is in `clock_nanosleep` or `poll`, the process is waiting.

### Writing to a file

```bash
# Write trace to a file instead of stderr
strace -o /tmp/trace.log ls /tmp

# With -f (follow forks), use -ff to write each PID to a separate file
strace -ff -o /tmp/trace ls /tmp
# Creates /tmp/trace.1234, /tmp/trace.1235, etc.
```

### Controlling output verbosity

```bash
# Show full strings (default truncates at 32 characters)
strace -s 1024 curl https://example.com

# Show the full path for file operations (resolve AT_FDCWD)
strace -y ls /tmp
# openat(AT_FDCWD</home/agent>, "/tmp", ...) = 3</tmp>

# Show fd paths in read/write
strace -yy cat /etc/hostname
# read(3</etc/hostname>, "myhost\n", 131072) = 7
# write(1</dev/pts/0>, "myhost\n", 7) = 7
```

The `-y` and `-yy` flags are extremely useful. Instead of seeing `write(3, ...)` and
having to figure out what fd 3 is, you see `write(3</var/log/app.log>, ...)`.

### The key insight

strace shows you what a program ACTUALLY DOES, not what it says it does, not what its
logs claim, not what you think it does. When there is a discrepancy between a process's
output and its behavior, strace shows the truth. The kernel does not lie.

> **AGENTIC GROUNDING:** When an agent's subprocess hangs, `strace -p PID` shows what
> syscall it is blocked on. If it is blocked on `read(0, ...)`, it is waiting for stdin -
> the agent probably forgot to close a pipe or provide input. If it is blocked on
> `poll([{fd=3, events=POLLIN}], ...)`, it is waiting for data on a socket - the network
> request has not completed. If it is blocked on `futex(0x..., FUTEX_WAIT, ...)`, there
> is lock contention - another thread holds a lock. Each diagnosis leads to a different
> fix, and strace tells you which one applies.

> **HISTORY:** strace for Linux was written by Paul Kranenburg in 1991, based on the
> System V utility `truss` (1992) and the SunOS `trace` command. The underlying mechanism
> is the `ptrace` syscall, which allows one process to observe and control another. ptrace
> is also the foundation of debuggers like gdb. It works by making the traced process stop
> at every syscall entry and exit, allowing the tracer to inspect the registers and memory.
> This is why strace slows the traced process down - every syscall requires two context
> switches to the tracer and back.

---

## 3. ltrace: Library Call Tracer

*Estimated time: 15 minutes*

Where strace traces syscalls (the kernel boundary), ltrace traces calls to shared library
functions - libc, libpthread, libm, and any other `.so` the process links against.

```bash
# Trace library calls made by a command
ltrace ls /tmp

# Output looks like:
# __libc_start_main(0x4023a0, 2, 0x7ffd..., ...) = 0
# opendir("/tmp")                          = 0x55b4a2
# readdir(0x55b4a2)                        = 0x55b4c8
# strcmp(".", ".")                          = 0
# readdir(0x55b4a2)                        = 0x55b4e0
# strcmp("..", "..")                        = 0
# readdir(0x55b4a2)                        = 0x55b4f8
# strlen("file1.txt")                      = 9
# ...
```

ltrace is higher-level than strace. Where strace shows `openat(AT_FDCWD, "/tmp", ...)`,
ltrace shows `opendir("/tmp")` - the libc wrapper that calls openat internally.

### When ltrace is useful

- **Tracking memory allocation:** `ltrace -e malloc+free` shows every heap allocation
  and deallocation. Useful for diagnosing memory leaks in C programs.

```bash
ltrace -e malloc+free -e realloc ./my_program
# malloc(1024)    = 0x55b4a0
# malloc(2048)    = 0x55b8b0
# free(0x55b4a0)
# malloc(4096)    = 0x55b4a0
# ...
```

- **Seeing string operations:** `ltrace -e strcmp+strncmp+strlen` shows what strings a
  program is comparing. Useful for understanding parsing logic or configuration matching.

- **Debugging dynamic linking issues:** ltrace shows calls to `dlopen`, `dlsym`, and
  `dlclose` - the dynamic linker's API for loading shared libraries at runtime.

### Limitations

ltrace is less commonly needed than strace because:

1. Many modern programs are statically linked or use Go/Rust (which do not use libc in
   the conventional way).
2. Python, Node.js, and other interpreted languages do not make meaningful libc calls at
   the level ltrace can intercept.
3. strace captures the definitive record of behavior (what reached the kernel). ltrace
   captures an intermediate layer.

ltrace is a niche tool for C/C++ debugging. Know it exists, reach for it when you need
to see library-level behavior, but strace is your primary instrument.

> **AGENTIC GROUNDING:** You are unlikely to use ltrace in routine agent verification.
> Its relevance is when debugging native binaries that agents invoke - compiled tools,
> system utilities, or native extensions in Python/Node packages. If a native binary
> segfaults during an agent operation, ltrace can show the library call that preceded
> the crash.

---

## 4. lsof: List Open Files

*Estimated time: 30 minutes*

lsof answers the question: "what files does this process have open?" Since everything
in Unix is a file - regular files, directories, sockets, pipes, devices - lsof shows
you everything a process is connected to.

### By process

```bash
# All open files for a specific process
lsof -p 1234

# Output columns:
# COMMAND  PID  USER  FD   TYPE  DEVICE  SIZE/OFF  NODE  NAME
# python3  1234 agent 0u   CHR   136,0       0t0     3  /dev/pts/0
# python3  1234 agent 1u   CHR   136,0       0t0     3  /dev/pts/0
# python3  1234 agent 2u   CHR   136,0       0t0     3  /dev/pts/0
# python3  1234 agent 3r   REG   259,2     4096  1234  /etc/config.yaml
# python3  1234 agent 4u   IPv4  56789       0t0  TCP  *:8080 (LISTEN)
```

### Understanding the columns

| Column | Meaning |
|--------|---------|
| COMMAND | First 9 characters of the process name |
| PID | Process ID |
| USER | Process owner |
| FD | File descriptor number and mode |
| TYPE | File type (REG, DIR, CHR, IPv4, IPv6, unix, FIFO, etc.) |
| DEVICE | Device numbers (major,minor) |
| SIZE/OFF | File size or current offset |
| NODE | Inode number (or protocol for sockets) |
| NAME | Filename, socket address, or pipe identifier |

### The FD column

The FD column shows the file descriptor number and access mode:

| Suffix | Meaning |
|--------|---------|
| `r` | Read access |
| `w` | Write access |
| `u` | Read and write (update) access |

Special values:

| Value | Meaning |
|-------|---------|
| `cwd` | Current working directory |
| `rtd` | Root directory |
| `txt` | Program text (the executable itself) |
| `mem` | Memory-mapped file |

So `0u` means fd 0 (stdin) open for read/write. `3r` means fd 3 open for reading.
`4w` means fd 4 open for writing.

### By port

```bash
# What process is listening on port 8080?
lsof -i :8080
# COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME
# python3  1234 agent 4u  IPv4  56789       0t0   TCP  *:8080 (LISTEN)

# All TCP connections
lsof -i tcp

# All UDP sockets
lsof -i udp

# Connections to a specific host
lsof -i @192.168.1.100

# Connections to a specific host and port
lsof -i @192.168.1.100:5432
```

### By file

```bash
# What processes have this file open?
lsof /var/log/syslog
# COMMAND  PID    USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME
# rsyslogd 567   root   7w  REG   259,2   1048576  9876  /var/log/syslog

# What processes have any file open in this directory?
lsof +D /var/log/
# Shows every process with an open file descriptor pointing into /var/log/

# Same but recursive
lsof +D /home/agent/project/
```

### Combining filters

```bash
# All network connections for a specific process
lsof -p 1234 -i

# All files opened by a specific user
lsof -u agent

# All files opened by a specific command
lsof -c python3
```

### Practical patterns

```bash
# "What is using port 3000?" (the most common lsof use case)
lsof -i :3000

# "Why can't I unmount this filesystem?"
lsof +D /mnt/usb

# "What files does the agent have open?"
lsof -p $(pgrep -f "agent-process-name")

# "Is anything writing to this log file?"
lsof /var/log/app.log

# "What sockets does this process have?"
lsof -p 1234 -i -a
# The -a flag means AND (intersection of filters, not union)
```

> **AGENTIC GROUNDING:** When an agent says "the server is running on port 8080," you
> verify with `lsof -i :8080`. If lsof returns nothing, no process has a socket bound
> to that port. The agent is wrong - or the server crashed between when the agent checked
> and when you checked. Either way, the claim does not match reality. Remember from Step 1:
> "everything is a file." lsof shows you the files. If a socket file does not exist, the
> connection does not exist.

> **HISTORY:** lsof was written by Victor Abell, starting in 1989 at Purdue University's
> Computing Center. It became essential because Unix's "everything is a file" abstraction
> means that understanding open files IS understanding process state. Abell maintained lsof
> for over 25 years across dozens of Unix variants (SunOS, AIX, HP-UX, Linux, FreeBSD,
> macOS). The tool's longevity reflects how fundamental the concept is: the set of open
> file descriptors fully describes a process's connections to the outside world.

---

## 5. ss: Socket Statistics

*Estimated time: 20 minutes*

ss is the modern replacement for netstat. It shows network socket information by reading
directly from the kernel via netlink sockets, which makes it faster than netstat (which
parsed text from `/proc/net/tcp`).

### The most common invocation

```bash
# TCP listening sockets with process names
ss -tlnp
# State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
# LISTEN  0       128     0.0.0.0:8080         0.0.0.0:*          users:(("python3",pid=1234,fd=4))
# LISTEN  0       128     0.0.0.0:22           0.0.0.0:*          users:(("sshd",pid=567,fd=3))
# LISTEN  0       128     127.0.0.1:5432       0.0.0.0:*          users:(("postgres",pid=890,fd=6))
```

The flags:

| Flag | Meaning |
|------|---------|
| `-t` | TCP sockets |
| `-u` | UDP sockets |
| `-l` | Listening sockets only |
| `-n` | Numeric (do not resolve port names or hostnames) |
| `-p` | Show process using the socket |
| `-a` | All sockets (listening + established + everything else) |
| `-s` | Summary statistics |

### Common invocations

```bash
# All TCP and UDP connections with process info
ss -tunap

# Socket summary (quick overview of all socket types)
ss -s
# Total: 234
# TCP:   45 (estab 12, closed 8, orphaned 0, timewait 5)
# UDP:   3

# Only established connections
ss state established

# Only connections to a specific destination
ss dst 192.168.1.100

# Only connections on a specific port
ss sport = :443

# Connections in TIME-WAIT state (recently closed)
ss state time-wait

# Connections to a specific destination port
ss dst :5432
```

### Reading ss output

```
State    Recv-Q  Send-Q  Local Address:Port    Peer Address:Port    Process
ESTAB    0       0       192.168.1.10:54321    93.184.216.34:443    users:(("curl",pid=2345,fd=5))
```

- **State** - TCP state (LISTEN, ESTAB, TIME-WAIT, CLOSE-WAIT, SYN-SENT, etc.)
- **Recv-Q** - bytes in the receive buffer (data received but not yet read by the process)
- **Send-Q** - bytes in the send buffer (data written but not yet acknowledged by the peer)
- **Local Address:Port** - this machine's IP and port
- **Peer Address:Port** - the remote machine's IP and port
- **Process** - the process name, PID, and fd number

Non-zero Recv-Q on an ESTAB connection means the process is not reading fast enough.
Non-zero Send-Q means the network is not draining fast enough (congestion, slow peer,
network issue).

### ss vs netstat

netstat is deprecated on modern Linux distributions. Some systems do not install it by
default. The differences:

| Feature | netstat | ss |
|---------|---------|-----|
| Data source | `/proc/net/tcp` (text parsing) | Netlink sockets (kernel IPC) |
| Speed | Slow on busy systems | Fast |
| Installed by default | Sometimes not | Always (part of iproute2) |
| Filter syntax | Limited | Rich (state, address, port filters) |

Use ss. If you see netstat in documentation or agent-generated commands, mentally
translate it.

> **AGENTIC GROUNDING:** `ss -tlnp` is the definitive answer to "what is listening on
> what port?" If an agent starts a server and claims it is listening on port 3000, run
> `ss -tlnp | grep :3000`. If the line exists, the server is listening. If not, it is
> not - regardless of what the agent's process reported to stdout. The process column
> also tells you WHICH process is listening, so you can verify it is the right one (not
> a stale process from a previous run).

---

## 6. /proc/$PID as a Process Observatory

*Estimated time: 15 minutes*

You covered `/proc` in Step 3. Here we focus specifically on using it for live process
observation, complementing strace, lsof, and ss.

### Status and state

```bash
PID=1234

# Process state, memory usage, thread count
cat /proc/$PID/status
# Name:   python3
# State:  S (sleeping)
# Pid:    1234
# PPid:   1000
# Threads: 4
# VmRSS:  45000 kB
# ...
```

Key fields in status:

| Field | Meaning |
|-------|---------|
| State | R (running), S (sleeping), D (disk sleep/uninterruptible), Z (zombie), T (stopped) |
| VmRSS | Resident set size - actual physical memory used |
| VmSize | Virtual memory size - total address space |
| Threads | Number of threads |
| voluntary_ctxt_switches | Process gave up CPU willingly (I/O wait, sleep) |
| nonvoluntary_ctxt_switches | Kernel preempted the process (CPU bound) |

The context switch counters are diagnostic gold. A process with high voluntary switches
is I/O bound (constantly waiting for disk or network). A process with high nonvoluntary
switches is CPU bound (the scheduler is taking the CPU away because the process used its
time slice).

### Open file descriptors

```bash
# List all open fds as symlinks
ls -la /proc/$PID/fd/
# lrwx------ 1 agent agent 64 Mar 10 10:00 0 -> /dev/pts/0
# lrwx------ 1 agent agent 64 Mar 10 10:00 1 -> /dev/pts/0
# lrwx------ 1 agent agent 64 Mar 10 10:00 2 -> /dev/pts/0
# lr-x------ 1 agent agent 64 Mar 10 10:00 3 -> /etc/config.yaml
# lrwx------ 1 agent agent 64 Mar 10 10:00 4 -> socket:[56789]

# Count open fds
ls /proc/$PID/fd/ | wc -l

# Find socket fds and cross-reference with ss
ls -la /proc/$PID/fd/ | grep socket
# lrwx------ 1 agent agent 64 Mar 10 10:00 4 -> socket:[56789]

# Then look up the socket inode in ss
ss -tunap | grep 56789
```

### Environment and command line

```bash
# The exact command line (null-delimited)
cat /proc/$PID/cmdline | tr '\0' ' '; printf '\n'

# Environment variables (null-delimited)
cat /proc/$PID/environ | tr '\0' '\n' | grep DATABASE_URL

# Current working directory
readlink /proc/$PID/cwd

# The actual binary being executed
readlink /proc/$PID/exe
```

### Memory mappings

```bash
# What shared libraries are loaded?
cat /proc/$PID/maps | grep '\.so'
# 7f1234560000-7f1234780000 r-xp ... /usr/lib/libc.so.6
# 7f1234780000-7f12347a0000 r--p ... /usr/lib/libpython3.11.so.1.0

# Or more readably
cat /proc/$PID/maps
```

### The TCP connection table

```bash
# Raw TCP connection data (what ss reads from the kernel)
cat /proc/$PID/net/tcp
# sl  local_address rem_address   st tx_queue rx_queue ...
#  0: 00000000:1F90 00000000:0000 0A 00000000:00000000 ...
```

The addresses are in hex (little-endian), the state (`st`) is a hex code (0A = LISTEN,
01 = ESTABLISHED). ss parses this for you - but knowing it is here means you can always
get the data even without ss.

> **AGENTIC GROUNDING:** `/proc/$PID/fd/` is the security observation point. When an
> agent process is running inside a container or sandbox, `ls -la /proc/$PID/fd/` shows
> every resource it has access to. If an agent process has an open fd to a file it
> should not be accessing, you can see it here. This is not theoretical - an agent that
> opens `/etc/shadow` or a credential file leaves evidence in its fd table.

---

## 7. Combining Tools for Diagnosis

*Estimated time: 15 minutes*

Individual tools answer specific questions. Real diagnosis requires combining them.
Here are the patterns.

### "Is the server running?"

```bash
# Step 1: Is anything listening on the expected port?
ss -tlnp | grep :8080

# If yes: what process? (shown in the ss output)
# If no: is the process alive at all?
pgrep -f "server-process-name"

# If the process exists but is not listening:
strace -p $PID -e trace=network
# Watch for bind() or listen() failures
```

### "What is this process doing?"

```bash
# Broad observation: what syscalls is it making right now?
strace -p $PID -e trace=file,network -f

# What files does it have open?
lsof -p $PID

# What is its CPU/memory state?
cat /proc/$PID/status | grep -E '^(State|VmRSS|Threads|voluntary)'
```

### "Why is the disk full?"

```bash
# What processes have large open files in /var/log?
lsof +D /var/log/ | sort -k7 -n -r | head -20

# Note: a deleted file can still consume disk space if a process
# has it open. lsof shows these as "(deleted)" in the NAME column.
lsof | grep '(deleted)' | sort -k7 -n -r | head -10
```

### "Why is this process slow?"

```bash
# Syscall time breakdown
strace -c -p $PID
# (let it run for 10-30 seconds, then Ctrl-C)

# Interpretation:
# - Most time in write/read -> I/O bound
# - Most time in futex -> lock contention
# - Most time in clock_nanosleep/poll/epoll_wait -> waiting
# - Most time in mmap/brk -> memory allocation pressure
```

### "Is the agent's database connection working?"

```bash
# Is there a TCP connection to the database port?
ss -tnp | grep :5432
# Shows the connection state (ESTAB, SYN-SENT, CLOSE-WAIT, etc.)

# Watch the syscalls on the database connection
strace -e trace=network -p $PID
# Look for sendto/recvfrom on the database socket fd

# What fd is the database connection?
lsof -p $PID -i :5432
# Shows the fd number, then you can filter strace to that fd
```

### "What files did the agent modify?"

```bash
# Trace file modifications in real time
strace -e trace=openat,rename,unlink,write -f -p $PID -o /tmp/file-trace.log

# After the operation, search the trace for writes
grep -E 'openat.*O_WRONLY|openat.*O_RDWR|rename|unlink' /tmp/file-trace.log
```

### "Why is this subprocess hanging?"

```bash
# What syscall is it blocked on?
strace -p $HANGING_PID

# Common answers:
# read(0, ...           -> waiting for stdin (pipe not closed, no input)
# read(3, ...           -> waiting for data on fd 3 (check what fd 3 is)
# poll([{fd=3, ...      -> waiting for events on a socket
# futex(...FUTEX_WAIT)  -> waiting for a lock
# accept(3, ...         -> waiting for incoming connections

# Find out what fd 3 is:
readlink /proc/$HANGING_PID/fd/3
# pipe:[12345]  -> it is waiting on a pipe
# socket:[67890] -> it is waiting on a socket (check ss)
```

> **AGENTIC GROUNDING:** The pattern is always the same: (1) identify the symptom, (2)
> choose the tool that observes at the right level, (3) compare the observation against the
> claim. An agent cannot perform this observation on itself. It operates at the application
> level. You operate at the kernel level. This is the verification asymmetry that makes the
> Operator role irreducible.

---

## 8. Quick Reference

The most common invocations, collected for fast lookup.

### strace

| Command | Purpose |
|---------|---------|
| `strace command` | Trace all syscalls of a new process |
| `strace -p PID` | Attach to running process |
| `strace -f -p PID` | Follow forked children |
| `strace -e trace=file` | Only file operations |
| `strace -e trace=network` | Only network operations |
| `strace -e trace=process` | Only process operations (fork, exec, exit) |
| `strace -e trace=openat,read,write` | Specific syscalls only |
| `strace -c -p PID` | Summary statistics (time per syscall) |
| `strace -t -T -p PID` | Wall clock timestamps + per-call duration |
| `strace -yy -p PID` | Show fd paths in output |
| `strace -s 1024` | Show full strings (default truncates at 32) |
| `strace -o file.log` | Write trace to file |
| `strace -ff -o prefix` | Separate file per PID when tracing children |

### ltrace

| Command | Purpose |
|---------|---------|
| `ltrace command` | Trace library calls of a new process |
| `ltrace -e malloc+free command` | Track memory allocation |
| `ltrace -e strcmp+strncmp command` | Track string comparisons |
| `ltrace -p PID` | Attach to running process |

### lsof

| Command | Purpose |
|---------|---------|
| `lsof -p PID` | All open files for a process |
| `lsof -i :8080` | What process uses port 8080 |
| `lsof -i tcp` | All TCP connections |
| `lsof -i udp` | All UDP connections |
| `lsof +D /path/dir` | All open files in directory (non-recursive: `+d`) |
| `lsof filename` | What processes have this file open |
| `lsof -u username` | All files opened by user |
| `lsof -c python3` | All files opened by command name |
| `lsof -p PID -i -a` | Network files only for a specific process |
| `lsof \| grep '(deleted)'` | Find deleted files still held open |

### ss

| Command | Purpose |
|---------|---------|
| `ss -tlnp` | TCP listening sockets with process names |
| `ss -tunap` | All TCP/UDP connections with process info |
| `ss -s` | Socket summary statistics |
| `ss state established` | Only established connections |
| `ss state time-wait` | Only TIME-WAIT connections |
| `ss dst 192.168.1.1` | Connections to specific destination |
| `ss sport = :443` | Connections from specific source port |
| `ss dport = :5432` | Connections to specific destination port |

### /proc/$PID

| Path | Purpose |
|------|---------|
| `/proc/$PID/status` | State, memory, threads, context switches |
| `/proc/$PID/fd/` | Open file descriptors (symlinks to targets) |
| `/proc/$PID/maps` | Memory mappings (loaded libraries) |
| `/proc/$PID/environ` | Environment variables (null-delimited) |
| `/proc/$PID/cmdline` | Command line (null-delimited) |
| `/proc/$PID/cwd` | Current working directory (symlink) |
| `/proc/$PID/exe` | Executable binary (symlink) |
| `/proc/$PID/net/tcp` | TCP connection table (raw kernel data) |
| `/proc/$PID/fdinfo/N` | Details about fd N (offset, flags) |

---

## Challenges

*Estimated time: 60 minutes total*

---

### Challenge 1: Annotate an strace

*Estimated time: 10 minutes*

Run `strace ls /tmp` and annotate every syscall in the output. For each line, write:

1. What the syscall does (one sentence)
2. What the arguments mean
3. What the return value means

Focus on these syscalls in particular:

- `execve` - the process replacing itself with `ls`
- `openat` - opening the directory `/tmp`
- `getdents64` - reading directory entries
- `write` - writing the listing to stdout
- `close` - closing file descriptors
- `exit_group` - terminating

You will also see many `mmap`, `mprotect`, and `openat` calls for shared libraries at
the start. These are the dynamic linker loading libc and other dependencies. You do not
need to annotate each one, but note the pattern: the linker opens each `.so` file, maps
it into memory, then closes the fd.

**Verification:** You should be able to explain the full lifecycle - from execve through
library loading, directory reading, output writing, and exit - in terms of syscalls.

> **AGENTIC GROUNDING:** When an agent runs a command and claims it succeeded, the strace
> is the ground truth. If the agent says "I listed the directory" but the strace shows
> `openat(AT_FDCWD, "/tmp", ...) = -1 EACCES (Permission denied)`, the listing failed.
> The agent may have caught the error, or it may have silently continued. The strace
> tells you what actually happened.

---

### Challenge 2: Trace a Web Request

*Estimated time: 15 minutes*

Start a Python HTTP server and trace a request end-to-end.

**Setup:**

```bash
# Terminal 1: Start the server
python3 -m http.server 8080 &
SERVER_PID=$!
printf 'Server PID: %s\n' "$SERVER_PID"
```

**Trace:**

```bash
# Terminal 1: Attach strace to the server
strace -f -e trace=network,read,write -yy -p $SERVER_PID -o /tmp/http-trace.log &
STRACE_PID=$!
sleep 1

# Terminal 1 (or Terminal 2): Make a request
curl -s http://localhost:8080/ > /dev/null

# Stop the trace
kill $STRACE_PID 2>/dev/null
wait $STRACE_PID 2>/dev/null
```

**Analysis:**

In `/tmp/http-trace.log`, identify:

1. The `accept` syscall - the server accepting the incoming connection. What fd was
   assigned to the new connection?
2. The `read` or `recvfrom` of the HTTP request - what did the client send? (You should
   see `GET / HTTP/1.1` in the buffer)
3. The `openat` of the file being served (the directory listing or index.html)
4. The `write` or `sendto` of the HTTP response - what headers did the server send?
5. The `close` of the connection fd

**Verification:** You should be able to reconstruct the entire HTTP request-response
cycle from the syscall trace, without looking at the server's application-level logs.

```bash
# Clean up
kill $SERVER_PID 2>/dev/null
```

---

### Challenge 3: The Hidden Pipe

*Estimated time: 10 minutes*

Trace a shell pipeline and identify the plumbing.

```bash
strace -f -e trace=pipe2,clone,dup2,execve,write,close \
  -o /tmp/pipe-trace.log \
  bash -c 'cat /dev/urandom | head -c 1000 | base64 | wc -c'
```

In the trace, identify:

1. How many `pipe2` calls were made? (One per `|` in the pipeline)
2. How many `clone` calls? (One per command in the pipeline)
3. For each child process, find the `dup2` calls that wire stdin/stdout to the pipe
   ends. Which fd numbers are being duplicated to 0 and 1?
4. Find the point where `head` closes - does `cat` receive SIGPIPE?
5. What is the final output of `wc -c`?

**Hint:** Use `grep -E '(pipe2|clone|dup2|execve|SIGPIPE)' /tmp/pipe-trace.log` to
filter the relevant lines.

> **AGENTIC GROUNDING:** Agents construct multi-stage pipelines routinely. When a
> pipeline produces unexpected output, the instinct is to modify the commands. The
> diagnostic approach is to trace the pipeline and find the exact point where data
> is lost, transformed, or blocked. This challenge builds that skill.

---

### Challenge 4: Port Detective

*Estimated time: 10 minutes*

Start three services and identify them using only ss and lsof.

```bash
# Service 1: Python HTTP server
python3 -m http.server 9001 &
PID1=$!

# Service 2: Netcat listener
nc -l -p 9002 &
PID2=$!

# Service 3: Another Python server
python3 -m http.server 9003 &
PID3=$!

sleep 1
```

Now, without using the PID variables:

1. Use `ss -tlnp` to find all three listening sockets. Record the PID, port, and fd
   for each.
2. Use `lsof -i :9001 -i :9002 -i :9003` to cross-reference. Do the PIDs and fds
   match?
3. Use `/proc/$PID/fd/` to find the socket fd for each process. Verify the socket
   inode matches what ss reports.
4. Kill one of the services. Run ss and lsof again. Verify it disappeared from both.
5. Start a new service on the same port. Verify it appears with a different PID.

```bash
# Clean up
kill $PID1 $PID2 $PID3 2>/dev/null
```

**Verification:** You should get consistent answers from ss, lsof, and /proc. If they
disagree, something is wrong with your commands (they read the same kernel data through
different interfaces).

---

### Challenge 5: Process Forensics

*Estimated time: 15 minutes*

This challenge simulates diagnosing an unknown process - an agent you did not write.

**Part A: Create the mystery process**

Save this as `/tmp/mystery.py` and run it:

```python
#!/usr/bin/env python3
"""A misbehaving process for forensic analysis."""
import os
import socket
import tempfile
import time
import threading

def background_writer():
    """Writes to a hidden temp file every 2 seconds."""
    fd, path = tempfile.mkstemp(prefix='.hidden-', dir='/tmp')
    while True:
        os.write(fd, f"tick {time.time()}\n".encode())
        time.sleep(2)

def network_beacon():
    """Periodically connects to localhost:12345."""
    while True:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect(('127.0.0.1', 12345))
            s.send(b"beacon\n")
            s.close()
        except (ConnectionRefusedError, socket.timeout, OSError):
            pass
        time.sleep(5)

def file_scanner():
    """Reads files from /etc/ periodically."""
    targets = ['/etc/hostname', '/etc/passwd', '/etc/os-release']
    while True:
        for path in targets:
            try:
                with open(path) as f:
                    _ = f.read()
            except (PermissionError, FileNotFoundError):
                pass
        time.sleep(3)

# Start background threads
threading.Thread(target=background_writer, daemon=True).start()
threading.Thread(target=network_beacon, daemon=True).start()
threading.Thread(target=file_scanner, daemon=True).start()

# Main thread just sleeps
print(f"PID: {os.getpid()}")
while True:
    time.sleep(60)
```

Run it:

```bash
python3 /tmp/mystery.py &
MYSTERY_PID=$!
```

**Part B: Investigate without reading the source**

Pretend you do not know what `mystery.py` does. Using only strace, lsof, ss, and /proc,
determine:

1. What files does the process have open? (`lsof -p $MYSTERY_PID`)
2. Is it making network connections? (`ss -tnp | grep $MYSTERY_PID`)
3. What syscalls is it making? (`strace -f -p $MYSTERY_PID` for 15 seconds)
4. What is it writing to? (Find the temp file in the strace output or lsof output)
5. What files is it reading from /etc/? (Filter strace for `openat` with `/etc/`)
6. How many threads does it have? (`cat /proc/$MYSTERY_PID/status | grep Threads`)
7. Where is the hidden temp file? (Check lsof output for `/tmp/.hidden-*`)

Write up your findings as a forensic report: what the process does, what resources it
accesses, and whether any of its behavior is concerning.

```bash
# Clean up
kill $MYSTERY_PID 2>/dev/null
```

> **AGENTIC GROUNDING:** This is exactly the skill you need when an agent spawns a
> subprocess and you need to verify what it is doing. The agent tells you what it intended.
> These tools tell you what actually happened. Discrepancies between intent and reality
> are where bugs and security issues live.

---

### Challenge 6: Build a Process Monitor

*Estimated time: 15 minutes*

Write a bash script `process-monitor.sh` that takes a PID and produces a continuously
updating dashboard.

Requirements:

1. Read CPU state from `/proc/$PID/stat` (field 3 is the state character)
2. Count open file descriptors from `/proc/$PID/fd/`
3. Show network connections from `ss -tnp` filtered to the PID
4. Show the last syscall (attach strace briefly, capture one line, detach)
5. Refresh every 2 seconds
6. Handle the case where the process exits (detect missing /proc/$PID, exit cleanly)

Skeleton:

```bash
#!/usr/bin/env bash
set -euo pipefail

pid=${1:?Usage: $0 <pid>}

if [ ! -d "/proc/$pid" ]; then
  printf 'Process %s does not exist\n' "$pid" >&2
  exit 1
fi

cmd=$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')

while [ -d "/proc/$pid" ]; do
  clear

  printf '=== Process Monitor: PID %s ===\n' "$pid"
  printf 'Command: %s\n' "$cmd"
  printf 'Time:    %s\n\n' "$(date '+%H:%M:%S')"

  # State
  state=$(cut -d' ' -f3 "/proc/$pid/stat" 2>/dev/null || printf 'unknown')
  printf 'State:   %s\n' "$state"

  # Memory
  rss=$(grep '^VmRSS:' "/proc/$pid/status" 2>/dev/null | awk '{print $2, $3}')
  printf 'Memory:  %s\n' "${rss:-unknown}"

  # Open fds
  fd_count=$(ls "/proc/$pid/fd/" 2>/dev/null | wc -l)
  printf 'Open FDs: %s\n' "$fd_count"

  # Threads
  threads=$(grep '^Threads:' "/proc/$pid/status" 2>/dev/null | awk '{print $2}')
  printf 'Threads: %s\n' "${threads:-unknown}"

  # Network connections
  printf '\nNetwork connections:\n'
  ss -tnp 2>/dev/null | grep "pid=$pid," || printf '  (none)\n'

  # Last syscall (brief strace, 1 second timeout)
  printf '\nLast observed syscall:\n'
  timeout 1 strace -p "$pid" -c -e trace=all 2>&1 | tail -5 || printf '  (could not trace)\n'

  sleep 2
done

printf '\nProcess %s has exited.\n' "$pid"
```

Test it against the mystery process from Challenge 5, or against a Python HTTP server
with active requests.

**Stretch goal:** Add color coding for the state field (green for R/S, yellow for D,
red for Z). Add a sparkline or counter for fd count changes over time.

---

## Key Takeaways

Before moving to Step 9, you should be able to answer:

1. What is a syscall, and why does observing syscalls give you complete visibility into
   a process's external behavior?

2. How do you determine what a hung process is waiting for? (What tool, what to look for)

3. Given a process PID, how do you find out what port it is listening on? (At least two
   methods)

4. Given a port number, how do you find out what process is listening on it? (At least
   two methods)

5. What is the difference between strace and ltrace? When would you use each?

6. What does `strace -c` tell you, and how do you interpret a process that spends most
   of its time in `futex`?

7. How do you find deleted files that are still consuming disk space?

8. Why does strace slow down the process being traced? (What mechanism does it use?)

9. What does a non-zero Recv-Q in ss output indicate?

10. How do you determine whether a process is I/O bound or CPU bound using these tools?

The unifying principle: **do not trust the output, verify the behavior.** The agent
reports what it thinks happened. These tools report what actually happened. When they
disagree, the tools are right.

---

## What to Read Next

[Step 9: Container Internals](/bootcamp/09-container-internals/) - a container is a process with restricted visibility.
Everything you learned here - strace, lsof, ss, /proc - works on container processes
because containers ARE processes. They run in Linux namespaces that restrict what they
can see (PID namespace, mount namespace, network namespace), but from the host, you can
observe them with the same tools. Step 9 covers namespaces, cgroups, and overlayfs -
the kernel mechanisms that create the illusion of isolation. The observation tools from
this step are how you see through that illusion.

---

## References

- Kerrisk, M. *The Linux Programming Interface* (2010) - chapter 22 (monitoring child
  processes), appendix A (tracing system calls). The definitive reference for ptrace and
  syscall semantics.
- `man 1 strace` - comprehensive documentation of all strace options and trace categories.
- `man 1 lsof` - the lsof manual. Dense but complete.
- `man 8 ss` - socket statistics manual, including filter expression syntax.
- `man 5 proc` - documentation of every file in `/proc/$PID/`.
- `man 2 ptrace` - the syscall that makes strace possible. Reading this explains why
  strace can see everything and why it slows the target process.
- Gregg, B. *Systems Performance: Enterprise and the Cloud* (2nd ed., 2020) - chapters
  on tracing tools and methodologies. Brendan Gregg's work on Linux observability is the
  standard reference for performance analysis.
- Abell, V. *lsof FAQ* - https://github.com/lsof-org/lsof - maintained documentation
  from the original author.
