+++
title = "The Unix Process Model"
date = "2026-03-10"
description = "File descriptors, pipes, and signals. The kernel primitives that everything else composes on."
tags = ["linux", "processes", "pipes", "signals", "bootcamp"]
step = 1
tier = 1
estimate = "4-6 hours"
sample = true
bootcamp = 1
+++

Step 1 of 12 in the Agentic Engineering Bootcamp.

---

## Why This is Step 1

Every agent you steer operates on Linux. When an agent writes a shell pipeline, spawns
a subprocess, redirects output to a file, or checks an exit code, it is invoking the Unix
process model. The agent does not understand what it is invoking. You must.

This step has the highest compositional leverage of any step in the bootcamp. Shell
scripting (Step 2), text pipelines (Step 3), Make (Step 4), containers (Step 8), and
process observation (Step 9) all decompose into the primitives covered here. If your
understanding of the process model is shallow, every subsequent step builds on sand.

The goal is not to memorise syscall signatures. The goal is to build a mental model
accurate enough that when an agent constructs a pipeline that silently drops data, or
spawns a subprocess that becomes a zombie, or writes a cleanup script that cannot survive
SIGKILL, you can see the problem before it reaches production.

---

## Table of Contents

1. [What is a Process](#1-what-is-a-process) (~30 min)
2. [fork/exec: The Two-Step Creation](#2-forkexec-the-two-step-creation) (~45 min)
3. [File Descriptors](#3-file-descriptors) (~45 min)
4. [Pipes](#4-pipes) (~45 min)
5. [Signals](#5-signals) (~30 min)
6. [Process Lifecycle and Exit Codes](#6-process-lifecycle-and-exit-codes) (~45 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [What to Read Next](#8-what-to-read-next)

---

## 1. What is a Process

*Estimated time: 30 minutes*

Most people learn that a process is "a running program." This is like saying a car is
"a moving engine." It is not wrong, but it is too shallow to be useful.

A process is a **kernel data structure**. On Linux, this is `struct task_struct`, defined
in `include/linux/sched.h` in the kernel source. It is approximately 6-8 KB of bookkeeping
that the kernel maintains for every running, sleeping, stopped, or zombie task on the
system. It contains:

- **A PID** - a unique integer identifying this process. PIDs are allocated sequentially
  and recycled after a process is fully reaped. PID 1 is init (or systemd on modern
  systems). PID 0 is the idle task (swapper), which is not a real process but a kernel
  scheduling artifact.

- **A memory map** - the virtual address space: code segment, data segment, heap, stack,
  memory-mapped files, shared libraries. Each process has its own page table, which means
  two processes can have the same virtual addresses pointing to different physical memory.
  This is isolation. It is not optional.

- **A set of file descriptors** - integers that index into this process's fd table. More
  on this in Section 3. This is the process's interface to everything outside its own
  memory: files, pipes, sockets, devices, terminals.

- **A set of signal handlers** - functions (or default dispositions) that are invoked
  when the process receives a signal. More in Section 5.

- **A parent** - every process except PID 1 has a parent. The parent is the process that
  called `fork()` to create it. This creates a tree. Run `pstree` to see it.

- **A state** - one of: Running (R), Sleeping (S, interruptible; D, uninterruptible),
  Stopped (T), Zombie (Z). The state determines what the scheduler does with the process.

- **Credentials** - real UID/GID, effective UID/GID, supplementary groups. These
  determine what the process is allowed to do.

- **A current working directory** - yes, `cwd` is per-process kernel state, not a shell
  variable. When you `cd /tmp`, the shell calls `chdir("/tmp")`, which updates the
  process's `cwd` in the kernel.

### Making it Concrete: /proc/self/

`/proc` is a virtual filesystem. It does not exist on disk. The kernel synthesises its
contents on the fly when you read from it. `/proc/self/` is a magic symlink that always
points to the `/proc/$PID/` directory of whatever process is reading it.

Open a terminal and run:

```bash
# What is my PID?
printf '%s\n' "My PID: $$"

# What does /proc/self point to?
readlink /proc/self

# What are my open file descriptors?
ls -la /proc/self/fd/

# What is my memory map?
cat /proc/self/maps | head -20

# What was my command line?
cat /proc/self/cmdline | tr '\0' ' '; printf '\n'

# What is my current working directory?
readlink /proc/self/cwd

# What binary am I running?
readlink /proc/self/exe

# What are my environment variables?
cat /proc/self/environ | tr '\0' '\n' | head -10

# What is my process status?
cat /proc/self/status | head -20
```

Every field in `/proc/self/status` corresponds to a field in `task_struct`. The kernel
is showing you its own bookkeeping. When you read `VmRSS` (resident set size), you are
reading how much physical RAM is currently mapped into this process's address space (not page table memory, which is `VmPTE`).
When you read `Threads`, you are reading the thread group size. This is not abstraction.
This is the data structure.

> **AGENTIC GROUNDING:** When an agent spawns a subprocess and you need to understand
> what it is doing, `/proc/$PID/` is your primary diagnostic tool. You can inspect its
> open file descriptors, its memory usage, its current working directory, its command
> line arguments, and its environment variables without attaching a debugger or modifying
> the process. Agents never check these. You should check them routinely.

---

## 2. fork/exec: The Two-Step Creation

*Estimated time: 45 minutes*

Every process on a Linux system (except PID 1 and kernel threads) was created by
`fork()`. This is not one design among many. It is the design.

### The Problem

You want to run a new program. You need a new process for it (separate memory, separate
fds, separate PID). How do you create one?

### The Windows Answer: CreateProcess

Windows provides `CreateProcess()`, which takes the path to an executable, command-line
arguments, environment variables, security attributes, and about a dozen other parameters,
and in one call creates a new process running the specified program.

This is conceptually simple. It is also monolithic. If you want to set up the new
process's environment before it starts running (redirect its output, change its working
directory, set resource limits, close inherited file descriptors), you must pass all of
that configuration to `CreateProcess` as parameters. The API grows with every new thing
you might want to configure.

### The Unix Answer: Separate Creation from Execution

Unix splits the operation into two syscalls:

1. **`fork()`** - creates a new process that is an almost-exact copy of the calling
   process. Same memory contents (via copy-on-write), same file descriptors, same signal
   handlers, same everything. The only differences: the child gets a new PID, and `fork()`
   returns 0 to the child and the child's PID to the parent.

2. **`exec()`** (actually a family: `execve`, `execvp`, `execl`, etc.) - replaces the
   current process's program image with a new one. The PID stays the same. The fd table
   stays the same (unless fds are marked close-on-exec). The memory is replaced entirely
   with the new program's code and data.

Between `fork()` and `exec()`, the child process is running the parent's code but has
its own copy of everything. This is the window where you set things up. You can:

- Close file descriptors the child should not inherit
- Open new file descriptors (e.g., redirect stdout to a file)
- Change the working directory with `chdir()`
- Set environment variables
- Set resource limits with `setrlimit()`
- Change user/group IDs with `setuid()`/`setgid()`
- Create pipes and wire them up with `dup2()`

Then you call `exec()` and the new program inherits all of this setup. The new program
does not need to know about any of it. It just reads from fd 0 and writes to fd 1, and
the plumbing is already in place.

This is composition. The setup logic and the program logic are decoupled.

### Why This Matters for Pipes

When the shell executes `ls | grep foo`, it does the following (simplified):

```
1. Create a pipe: pipe(pipefd)    -- pipefd[0] = read end, pipefd[1] = write end
2. fork() -- child 1 (will become ls):
     a. dup2(pipefd[1], 1)        -- redirect stdout to pipe write end
     b. close(pipefd[0])          -- child doesn't need the read end
     c. close(pipefd[1])          -- original write end fd no longer needed (dup'd to 1)
     d. exec("ls")
3. fork() -- child 2 (will become grep):
     a. dup2(pipefd[0], 0)        -- redirect stdin to pipe read end
     b. close(pipefd[1])          -- child doesn't need the write end
     c. close(pipefd[0])          -- original read end fd no longer needed (dup'd to 0)
     d. exec("grep", "foo")
4. Parent closes both pipe fds    -- parent doesn't use the pipe
5. Parent wait()s for both children
```

Read this carefully. The pipe is created in the parent. The children inherit the pipe
fds via fork(). Each child redirects the appropriate end to stdin or stdout using dup2(),
closes the fds it does not need, and then exec()s the target program.

`ls` does not know it is writing to a pipe. It writes to fd 1 (stdout) as always. The
plumbing was set up before `ls` started running. This is the power of fork/exec
separation.

If Unix used a `CreateProcess`-style monolithic call, you would need to pass "redirect
stdout to this pipe fd" as a parameter. With fork/exec, you just... do it, using the
same syscalls you would use for any fd manipulation.

> **HISTORY:** Doug McIlroy had been thinking about connecting programs together since
> 1964, when he wrote a memo proposing that programs should be connected "like garden
> hoses - screw in another segment when it becomes necessary to massage data in another
> way." But pipes did not exist in Unix until 1973. Ken Thompson implemented them in a
> single night after McIlroy's persistent advocacy. The next morning, the entire Unix
> group at Bell Labs rewrote their programs to use pipes. The PDP-11's limited memory
> (typically 64-256 KB) made pipes practical rather than theoretical - you could not hold
> an entire file in memory, so streaming data between programs was not just elegant, it
> was necessary. The fork/exec split, which Thompson and Ritchie had already designed for
> other reasons, turned out to be exactly the mechanism pipes needed. This was not
> planned. It was a happy consequence of good decomposition.

### Seeing fork/exec in Action

You can trace the syscalls directly:

```bash
# Trace a simple pipe and watch the fork/exec/pipe/dup2 calls
strace -f -e trace=clone,execve,pipe,dup2,close,write -o /tmp/pipe-trace.txt \
  bash -c 'echo hello | cat'

# Read the trace (it will be verbose - focus on the syscall names)
grep -E '(clone|execve|pipe|dup2)' /tmp/pipe-trace.txt
```

`strace -f` follows child processes across forks. You will see `clone()` (the modern
Linux implementation of fork), `pipe()` creating the fd pair, `dup2()` wiring them up,
and `execve()` replacing the program images.

> **AGENTIC GROUNDING:** Agents frequently construct multi-stage shell commands. When
> something goes wrong, the agent's instinct is to modify the command. Your instinct
> should be to trace the command - `strace -f` shows you exactly what the kernel is doing.
> An agent cannot run strace. You can. This is a diagnostic advantage that requires
> understanding fork/exec to interpret.

---

## 3. File Descriptors

*Estimated time: 45 minutes*

A file descriptor is an integer. That is all it is at the userspace level. It is an index
into a per-process table maintained by the kernel.

### The fd Table

Every process has an fd table. Each entry points to a kernel-internal "file description"
(also called an "open file description" in POSIX terminology). The file description
contains:

- The current file offset (read/write position)
- The access mode (read-only, write-only, read-write)
- Status flags (append, non-blocking, etc.)
- A reference to the underlying kernel object (inode, pipe, socket, device, etc.)

The key insight: **file descriptors are not files**. They are handles. The same file on
disk can be opened by two different fds, and each fd has its own offset. Two different
fds (possibly in different processes) can point to the same file description, sharing an
offset - this is what happens after `fork()` or `dup()`.

### The Three Standard Descriptors

By convention (enforced by the C library and every shell):

| fd | Name   | Default destination | Purpose                |
|----|--------|---------------------|------------------------|
| 0  | stdin  | Terminal input      | Data input to program  |
| 1  | stdout | Terminal output     | Data output from program |
| 2  | stderr | Terminal output     | Error/diagnostic output |

These are not special at the kernel level. They are just fds 0, 1, and 2. They are
special by convention because every program agrees to read input from 0, write output to
1, and write errors to 2.

> **HISTORY:** Why does stderr exist? It seems redundant if stdout already goes to the
> terminal. The answer becomes obvious the moment you pipe stdout somewhere:
> `sort bigfile > sorted.txt`. If `sort` encounters an error (e.g., disk full), where
> does the error message go? If there is only stdout, the error message goes into
> `sorted.txt`, corrupting your output. stderr (fd 2) exists so that error messages can
> reach the human even when stdout is redirected. This was not in the original Unix -
> it was added to Version 6 Unix (1975) after practical experience showed it was
> necessary. Before stderr, programs either wrote errors to stdout (corrupting pipelines)
> or opened `/dev/tty` directly (brittle and non-composable).

### open() and the Lowest Unused fd

The `open()` syscall returns the lowest-numbered fd that is not currently in use. This
is a guarantee, not an implementation detail. It is specified by POSIX.

This matters because if you close fd 0 and then open a file, the file gets fd 0. Now
anything that reads from "stdin" (fd 0) reads from your file. This is one mechanism
behind input redirection.

```bash
# Demonstrate: close stdin, open a file, it becomes fd 0
python3 -c "
import os
# Show current fd 0
print(f'fd 0 points to: {os.readlink(\"/proc/self/fd/0\")}')
# Close fd 0
os.close(0)
# Open a file - it gets fd 0 (lowest unused)
fd = os.open('/etc/hostname', os.O_RDONLY)
print(f'Opened file got fd: {fd}')
print(f'fd 0 now points to: {os.readlink(\"/proc/self/fd/0\")}')
# Read from fd 0
content = os.read(0, 1024)
print(f'Read from fd 0: {content.decode().strip()}')
"
```

### dup2: The Redirection Primitive

`dup2(oldfd, newfd)` makes `newfd` point to the same kernel object as `oldfd`. If
`newfd` is already open, it is silently closed first.

This is the syscall behind all shell redirections:

| Shell syntax     | Equivalent syscall(s)                                    |
|------------------|----------------------------------------------------------|
| `> file`         | `fd = open("file", O_WRONLY\|O_CREAT\|O_TRUNC); dup2(fd, 1); close(fd)` |
| `>> file`        | `fd = open("file", O_WRONLY\|O_CREAT\|O_APPEND); dup2(fd, 1); close(fd)` |
| `< file`         | `fd = open("file", O_RDONLY); dup2(fd, 0); close(fd)`   |
| `2>&1`           | `dup2(1, 2)` - make fd 2 point where fd 1 points        |
| `2> file`        | `fd = open("file", ...); dup2(fd, 2); close(fd)`        |
| `>&2`            | `dup2(2, 1)` - make fd 1 point where fd 2 points        |

The order matters. `cmd > file 2>&1` and `cmd 2>&1 > file` produce different results:

```
cmd > file 2>&1
  Step 1: open("file"), dup2 to fd 1.  fd 1 -> file
  Step 2: dup2(1, 2).                  fd 2 -> file (same as fd 1)
  Result: both stdout and stderr go to file.

cmd 2>&1 > file
  Step 1: dup2(1, 2).                  fd 2 -> terminal (where fd 1 currently points)
  Step 2: open("file"), dup2 to fd 1.  fd 1 -> file
  Result: stdout goes to file, stderr goes to terminal.
```

This is not a quirk. It is left-to-right evaluation of fd operations. Once you understand
dup2, the behavior is obvious.

> **AGENTIC GROUNDING:** Agents frequently generate redirections like `2>&1` without
> understanding the evaluation order. A common agent mistake is writing
> `cmd 2>&1 > /dev/null` intending to suppress all output, when the correct form is
> `cmd > /dev/null 2>&1`. The agent tested it in a context where stderr was empty, so
> the error was invisible. You need to understand dup2 evaluation order to catch this.

### Inspecting File Descriptors

For any process, you can inspect its fd table:

```bash
# Start a background process to inspect
python3 -m http.server 8888 &
SERVER_PID=$!
sleep 1

# Method 1: /proc filesystem
ls -la /proc/$SERVER_PID/fd/

# Method 2: lsof (list open files)
lsof -p $SERVER_PID

# Method 3: the fd info files (Linux-specific)
cat /proc/$SERVER_PID/fdinfo/0

# Clean up
kill $SERVER_PID
```

Each symlink in `/proc/$PID/fd/` shows what the fd points to:
- A regular file: `/path/to/file`
- A pipe: `pipe:[inode_number]`
- A socket: `socket:[inode_number]`
- A terminal: `/dev/pts/N`
- An anonymous inode: `anon_inode:[eventpoll]`
- `/dev/null`: the data sink

> **AGENTIC GROUNDING:** The `printf` vs `echo` standing order in this project exists
> because of fd-level behavior. `echo "value"` writes `value\n` to fd 1. The trailing
> newline is part of the byte stream. When this is piped to a CLI tool that reads from
> fd 0, the tool receives `value\n`, not `value`. For tools that trim whitespace, this
> does not matter. For tools that use the exact bytes (API keys, feature flags, binary
> data), the extra `\n` silently corrupts the value. `printf 'value'` writes exactly
> `value` with no trailing newline. This is a file descriptor problem: the bytes written
> to fd 1 are the bytes read from fd 0 in the next pipeline stage. There is no magic
> cleanup layer in between.

---

## 4. Pipes

*Estimated time: 45 minutes*

A pipe is a unidirectional byte stream with a kernel-managed buffer. It is the mechanism
that makes `cmd1 | cmd2` work.

### The pipe() Syscall

`pipe()` takes an array of two integers and fills them in:

- `pipefd[0]` - the read end
- `pipefd[1]` - the write end

Bytes written to `pipefd[1]` are buffered by the kernel and can be read from `pipefd[0]`.
The buffer is finite. On Linux, the default size is 64 KB (16 pages of 4096 bytes). You
can query and modify it:

```bash
# Check the default pipe buffer size on your system
# (this creates a pipe and reads its capacity)
python3 -c "
import os, fcntl
r, w = os.pipe()
# F_GETPIPE_SZ = 1032 on Linux
size = fcntl.fcntl(r, 1032)
print(f'Default pipe buffer size: {size} bytes ({size // 1024} KB)')
os.close(r)
os.close(w)
"
```

### What Happens at the Boundaries

Understanding pipe behavior requires knowing what happens in the edge cases:

**Writer writes, buffer has space:** The write completes immediately. The bytes are copied
into the kernel buffer.

**Writer writes, buffer is full:** The writer blocks (sleeps) until the reader consumes
some data, freeing buffer space. This is backpressure. It is automatic and invisible.
It is also how a fast producer is throttled to match a slow consumer without any
application-level flow control.

**Reader reads, buffer has data:** The read returns immediately with available data (up
to the requested amount).

**Reader reads, buffer is empty, writer still open:** The reader blocks until data
arrives.

**Reader reads, buffer is empty, writer closed:** The read returns 0 (EOF). This is how
the reader knows the pipeline is done.

**Writer writes, reader has closed:** The kernel sends SIGPIPE to the writer. If the
writer does not handle SIGPIPE, it dies. This is correct behavior - there is no point
writing data that nobody will read. The default SIGPIPE handler terminates the process,
which is what you want in a pipeline: if `head -1` closes after reading one line, the
upstream command gets SIGPIPE and stops, rather than grinding through its entire input.

### How the Shell Builds a Pipeline

Let us trace `ls -la /usr/bin | grep python | wc -l` at the syscall level:

```
Shell process (PID 1000):

1. pipe(pipe_A)         -- creates fds for connection between ls and grep
2. pipe(pipe_B)         -- creates fds for connection between grep and wc

3. fork() -> child PID 1001 (will become ls):
     dup2(pipe_A[1], 1) -- stdout -> pipe A write end
     close(pipe_A[0])   -- don't need pipe A read end
     close(pipe_A[1])   -- don't need original write fd (it's dup'd to 1)
     close(pipe_B[0])   -- don't need pipe B at all
     close(pipe_B[1])
     execve("/bin/ls", ["ls", "-la", "/usr/bin"])

4. fork() -> child PID 1002 (will become grep):
     dup2(pipe_A[0], 0) -- stdin -> pipe A read end
     dup2(pipe_B[1], 1) -- stdout -> pipe B write end
     close(pipe_A[0])   -- originals no longer needed
     close(pipe_A[1])
     close(pipe_B[0])
     close(pipe_B[1])
     execve("/bin/grep", ["grep", "python"])

5. fork() -> child PID 1003 (will become wc):
     dup2(pipe_B[0], 0) -- stdin -> pipe B read end
     close(pipe_A[0])   -- don't need pipe A at all
     close(pipe_A[1])
     close(pipe_B[0])   -- originals no longer needed
     close(pipe_B[1])
     execve("/usr/bin/wc", ["wc", "-l"])

6. Shell closes all pipe fds (they're in the children now)
7. Shell wait()s for all three children
```

Notice how carefully every unused fd is closed. If the shell forgot to close `pipe_A[1]`
in the grep child, grep would never see EOF on its stdin, because the write end of
pipe A would still be open (in grep's process). grep would block forever waiting for more
input. This is a real bug class. It happens when programs (or agents) create pipes and
forget to close unused ends.

### Seeing Pipes in /proc

```bash
# Start a pipeline in the background
sleep 100 | cat &

# Get the PIDs
SLEEP_PID=$(jobs -p | head -1)
# The cat process is a child of the subshell, find it:
CAT_PID=$(pgrep -P $$ cat 2>/dev/null || pgrep -n cat)

# Inspect the file descriptors
ls -la /proc/$SLEEP_PID/fd/ 2>/dev/null
ls -la /proc/$CAT_PID/fd/ 2>/dev/null

# You'll see pipe:[NNNNN] entries - the inode numbers match between
# sleep's fd 1 (stdout) and cat's fd 0 (stdin)

# Clean up
kill %1 2>/dev/null
```

### Named Pipes (FIFOs)

A named pipe is a pipe with a filesystem entry. It is created with `mkfifo`:

```bash
# Create a named pipe
mkfifo /tmp/my_pipe

# In one terminal, write to it (this will block until a reader opens it)
printf 'hello from writer\n' > /tmp/my_pipe &

# In the same terminal, read from it
cat /tmp/my_pipe

# Clean up
rm /tmp/my_pipe
```

Named pipes are useful when you need pipe semantics between processes that are not in a
parent-child relationship. The kernel behavior is identical to anonymous pipes - the
filesystem entry is just a rendezvous point.

> **AGENTIC GROUNDING:** When an agent constructs `curl https://api.example.com/data |
> jq '.items[]' | xargs -I{} process_item {}`, it is relying on three processes
> connected by two pipes. If `curl` fails (HTTP 404, DNS resolution failure, timeout),
> it writes an error to stderr and writes the error response body (or nothing) to stdout.
> `jq` receives this on stdin and either produces no output (empty input) or fails with a
> parse error (HTML error page is not valid JSON). Either way, `xargs` gets no input and
> does nothing. The pipeline exits successfully (exit code 0 from xargs, the last
> command). The agent reports success. No items were processed. This is a silent failure
> caused by the pipeline architecture: each stage only sees its stdin, not the semantic
> success or failure of upstream stages. Understanding this failure mode requires
> understanding how pipes connect processes.

---

## 5. Signals

*Estimated time: 30 minutes*

A signal is an asynchronous notification delivered to a process by the kernel. It
interrupts whatever the process is doing and invokes a handler function (or a default
action).

### The Important Signals

| Signal  | Number | Default Action | Meaning                          | Can Catch? |
|---------|--------|----------------|----------------------------------|------------|
| SIGHUP  | 1      | Terminate      | Terminal hung up                 | Yes        |
| SIGINT  | 2      | Terminate      | Interrupt from keyboard (Ctrl-C) | Yes        |
| SIGQUIT | 3      | Core dump      | Quit from keyboard (Ctrl-\\)    | Yes        |
| SIGKILL | 9      | Terminate      | Forced kill                      | **No**     |
| SIGPIPE | 13     | Terminate      | Write to pipe with no readers    | Yes        |
| SIGTERM | 15     | Terminate      | Polite termination request       | Yes        |
| SIGCHLD | 17     | Ignore         | Child process state changed      | Yes        |
| SIGSTOP | 19     | Stop           | Forced stop                      | **No**     |
| SIGCONT | 18     | Continue       | Resume stopped process           | Yes        |
| SIGTSTP | 20     | Stop           | Stop from keyboard (Ctrl-Z)     | Yes        |

The two signals that cannot be caught, blocked, or ignored: **SIGKILL** and **SIGSTOP**.
Everything else can be handled by the process.

### SIGTERM vs SIGKILL

This distinction is load-bearing:

**SIGTERM** (signal 15) is a polite request. It says "please shut down." The process can
catch it and run cleanup code: close database connections, flush buffers, remove temporary
files, notify peers, save state. Well-written programs handle SIGTERM.

**SIGKILL** (signal 9) is not a request. The kernel does not deliver it to the process.
The kernel simply removes the process from the scheduler. No cleanup code runs. No
buffers are flushed. No temporary files are removed. The process is gone.

This is why `kill -9` is a last resort. It is also why the `timeout` command uses a
two-stage approach:

```bash
# timeout sends SIGTERM first, waits 5 seconds, then sends SIGKILL
timeout --signal=TERM --kill-after=5 30 long_running_command
```

### Signal Handlers in Bash

Bash provides `trap` for signal handling:

```bash
#!/usr/bin/env bash

TMPFILE=$(mktemp)
printf 'Working with temp file: %s\n' "$TMPFILE"

# Register cleanup function for SIGTERM, SIGINT, and EXIT
cleanup() {
  printf 'Cleaning up %s\n' "$TMPFILE"
  rm -f "$TMPFILE"
}
trap cleanup SIGTERM SIGINT EXIT

# Do work
printf 'data\n' > "$TMPFILE"
sleep 30  # Simulate long work

# If we reach here normally, EXIT trap fires on exit
```

Test this:

```bash
# Run it in the background
bash /tmp/signal_test.sh &
PID=$!

# Send SIGTERM
kill -TERM $PID
# You'll see the cleanup message

# Now test with SIGKILL
bash /tmp/signal_test.sh &
PID=$!
kill -KILL $PID
# No cleanup message - the handler never ran
# The temp file is leaked
```

### SIGPIPE: The Pipeline Terminator

SIGPIPE is delivered when a process writes to a pipe (or socket) whose read end has been
closed. The default handler terminates the process.

```bash
# Generate infinite output, pipe to head (which closes after 5 lines)
yes "infinite line" | head -5

# yes gets SIGPIPE after head closes its stdin
# Without SIGPIPE, yes would run forever, writing to a broken pipe
# and getting EPIPE errors on every write

# You can see the exit status:
yes "infinite line" | head -5
printf 'yes exit code: %s\n' "${PIPESTATUS[0]}"
# 141 = 128 + 13 (SIGPIPE is signal 13)
```

Exit code 141 (128 + signal number) tells you the process was killed by a signal. This
is a convention: when a process is killed by signal N, the shell reports exit code 128+N.

### SIGCHLD: The Child Notification

When a child process changes state (exits, stops, continues), the kernel sends SIGCHLD
to the parent. This is how a shell knows that a background command has finished.

If the parent does not handle SIGCHLD (by calling `wait()` or installing a handler), the
child becomes a zombie after it exits. More on this in Section 6.

> **AGENTIC GROUNDING:** The `timeout` command is used extensively in agent-dispatched
> tasks (including the POLECAT wrapper in this project's Makefile). It relies on SIGTERM
> and SIGKILL to enforce time limits. If an agent-spawned process installs a SIGTERM
> handler that does not actually exit (a real bug class - the handler runs cleanup but
> forgets to call `exit`), `timeout` falls back to SIGKILL after the grace period. But
> any cleanup the process was supposed to do (flushing logs, saving state) does not
> happen. Understanding this requires understanding the signal hierarchy.

---

## 6. Process Lifecycle and Exit Codes

*Estimated time: 45 minutes*

### The Full Lifecycle

```
Parent calls fork()
        |
        v
  Child process exists
  (copy of parent)
        |
        v
  Child calls exec()     [optional - child may do work as a copy of parent]
        |
        v
  New program runs
        |
        v
  Program calls exit(N)  [or returns from main, or killed by signal]
        |
        v
  Zombie state           [process exited but parent hasn't called wait()]
        |
        v
  Parent calls wait()    [collects exit status, kernel frees task_struct]
        |
        v
  Process fully gone
```

### Zombies

A zombie process is a process that has exited but whose parent has not yet called `wait()`
to collect its exit status. The process is not running. It consumes no CPU and no memory
(its memory was freed on exit). But it consumes a PID and a slot in the process table
(`task_struct` still exists so the kernel can store the exit status until the parent
collects it).

One zombie is harmless. Thousands of zombies can exhaust the PID space (default maximum
is 32768 on many systems, adjustable via `/proc/sys/kernel/pid_max`).

Creating a zombie for observation:

```bash
# This script creates a zombie
python3 -c "
import os, time

pid = os.fork()
if pid == 0:
    # Child: exit immediately
    os._exit(42)
else:
    # Parent: don't call wait(), just sleep
    print(f'Child PID: {pid}')
    print(f'Parent PID: {os.getpid()}')
    print('Child has exited. Parent is not calling wait().')
    print('The child is now a zombie. Check with: ps aux | grep Z')
    time.sleep(30)
    # After this sleep, parent exits, init adopts and reaps the zombie
" &

# While that's running, observe the zombie:
sleep 1
ps aux | grep -E 'Z|defunct'
```

You will see a process in state `Z` (zombie) or marked `<defunct>`. It has no memory
mapped, no open fds, no nothing - just a `task_struct` holding exit code 42, waiting for
its parent to call `wait()`.

### Orphans

An orphan is a process whose parent has exited. The kernel reassigns the orphan's parent
to PID 1 (init/systemd). PID 1 is designed to call `wait()` on its adopted children, so
orphans are automatically reaped when they eventually exit.

The double-fork technique uses this:

```
1. Parent forks child
2. Child forks grandchild
3. Child exits immediately (parent reaps it)
4. Grandchild is orphaned, adopted by init
5. Grandchild runs independently - init will reap it when it's done
```

This is how daemons traditionally detach from their parent. The grandchild has no
connection to the original parent's terminal or process group.

### Exit Codes

When a process exits, it provides a status byte (0-255). By universal convention:

- **0** means success
- **Non-zero** means failure

There is no enforcement of this convention. A program can exit 0 after catastrophic
failure. A program can exit 1 after complete success. The convention holds because every
tool in the Unix ecosystem (shells, Make, CI systems, init systems) treats 0 as success
and non-zero as failure.

Some common non-zero codes:

| Code | Common meaning                                        |
|------|-------------------------------------------------------|
| 1    | General error                                         |
| 2    | Misuse of shell command / invalid arguments           |
| 126  | Command found but not executable                      |
| 127  | Command not found                                     |
| 128+N| Killed by signal N (e.g., 137 = 128+9 = killed by SIGKILL) |
| 130  | 128+2 = killed by SIGINT (Ctrl-C)                    |
| 141  | 128+13 = killed by SIGPIPE                            |

### Exit Codes in the Shell

```bash
# $? holds the exit code of the last command
ls /nonexistent
printf 'Exit code: %s\n' "$?"

# && runs next command ONLY if previous succeeded (exit 0)
true && printf 'This runs\n'
false && printf 'This does not run\n'

# || runs next command ONLY if previous failed (non-zero)
false || printf 'This runs (fallback)\n'
true || printf 'This does not run\n'
```

### The Gate is Exit Code Chaining

This project's quality gate:

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

This is not scripting. This is control flow over exit codes. If `typecheck` returns
non-zero, `lint` never runs. If `lint` returns non-zero, `test` never runs. The overall
exit code is the exit code of the last command that ran.

Every CI/CD system in existence works this way. GitHub Actions, GitLab CI, Jenkins - they
all run shell commands and check exit codes. The entire software delivery pipeline is
built on the convention that 0 means success.

### PIPESTATUS and pipefail

In a pipeline `cmd1 | cmd2 | cmd3`, the shell's `$?` is the exit code of the **last**
command (`cmd3`). The exit codes of `cmd1` and `cmd2` are silently discarded.

This is dangerous:

```bash
# curl fails, but wc succeeds, so $? is 0
curl https://nonexistent.invalid/data 2>/dev/null | wc -l
printf 'Exit code: %s\n' "$?"
# Prints "0" and a line count of 0 - looks like success with empty data
```

Bash provides two mechanisms to address this:

**`${PIPESTATUS[@]}`** - an array of exit codes for every command in the last pipeline:

```bash
curl https://nonexistent.invalid/data 2>/dev/null | wc -l
printf 'curl: %s, wc: %s\n' "${PIPESTATUS[0]}" "${PIPESTATUS[1]}"
```

**`set -o pipefail`** - the pipeline's exit code is the exit code of the rightmost
command that failed (non-zero), or 0 if all succeeded:

```bash
set -o pipefail
curl https://nonexistent.invalid/data 2>/dev/null | wc -l
printf 'Pipeline exit code: %s\n' "$?"
# Now this is non-zero (curl's exit code)
```

### The set -e Trap

`set -e` (exit on error) causes the script to exit immediately when any command returns
non-zero. Agents love `set -e`. It seems safe. It is not.

`set -e` does NOT apply to commands that are part of a pipeline (except the last one,
unless `pipefail` is set). It also does not apply to commands in `if` conditions, `while`
conditions, commands after `||` or `&&`, or commands in subshells that are part of a
command substitution.

```bash
#!/usr/bin/env bash
set -e

# This WILL exit the script (simple command fails)
false
printf 'Never reached\n'
```

```bash
#!/usr/bin/env bash
set -e

# This will NOT exit the script (false is in a pipeline, not the last command)
false | true
printf 'This runs! Pipeline exit code was 0 (from true)\n'
```

```bash
#!/usr/bin/env bash
set -eo pipefail

# NOW this exits the script (pipefail makes false's exit code propagate)
false | true
printf 'Never reached\n'
```

The safe bash header for scripts that agents should be generating:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e` - exit on error
- `-u` - error on unset variables (catches typos in variable names)
- `-o pipefail` - pipeline fails if any component fails

> **AGENTIC GROUNDING:** Agents generate `set -e` scripts constantly. They almost never
> add `pipefail`. This means every pipeline in the script is a potential silent failure
> point. When reviewing agent-generated bash scripts, the first thing to check is the
> header. If it says `set -e` without `pipefail`, every pipeline in the script needs
> individual scrutiny. The correct header is `set -euo pipefail`. If an agent generates
> a script without this header, it is a defect.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

These challenges are designed to be run on a Linux system (Arch, Debian, Ubuntu, or any
distribution with standard GNU/Linux tools). Each one exercises a specific concept from
this step.

---

### Challenge 1: Explore /proc/self

*Estimated time: 10 minutes*

Write a sequence of commands that discovers the following about your current shell
process, using only `/proc/self/` and standard tools:

1. Its PID (without using `$$`)
2. All open file descriptors and what they point to
3. Its memory map (just the first 10 lines)
4. Its command line arguments (null-separated, you'll need to handle the null bytes)
5. Its parent PID (from `/proc/self/status`)
6. Its current working directory
7. The binary executable it is running
8. How many threads it has

Verify your answers against the output of `ps`, `$$`, and `pwd`.

<details>
<summary>Hints</summary>

```bash
# 1. PID
cat /proc/self/status | grep -m1 '^Pid:'
# Compare with: printf '%s\n' "$$"

# 2. File descriptors
ls -la /proc/self/fd/

# 3. Memory map
head -10 /proc/self/maps

# 4. Command line (null bytes to spaces)
cat /proc/self/cmdline | tr '\0' ' '; printf '\n'

# 5. Parent PID
grep PPid /proc/self/status

# 6. cwd
readlink /proc/self/cwd

# 7. Binary
readlink /proc/self/exe

# 8. Thread count
grep Threads /proc/self/status
```

Note: For item 1, `cat /proc/self/status` will show the PID of `cat`, not your shell.
To get your shell's PID, read `/proc/$$/status` or use `grep Pid /proc/self/status`
from within a bash built-in context.

</details>

---

### Challenge 2: Build a Pipe by Hand

*Estimated time: 15 minutes*

Write a Python script that creates a pipe with `os.pipe()`, forks with `os.fork()`,
writes a message from child to parent through the pipe, and reaps the child with
`os.wait()`. This replicates what the shell does for `echo "Hello" | cat` without
any shell machinery.

<details>
<summary>Solution</summary>

```python
#!/usr/bin/env python3
"""Build a pipe by hand - no shell involved."""
import os

def main():
    read_fd, write_fd = os.pipe()
    print(f"Created pipe: read_fd={read_fd}, write_fd={write_fd}")

    pid = os.fork()

    if pid == 0:
        # Child process
        os.close(read_fd)
        message = f"Hello from child process (PID: {os.getpid()})\n"
        os.write(write_fd, message.encode())
        os.close(write_fd)
        os._exit(0)
    else:
        # Parent process
        os.close(write_fd)
        data = b""
        while True:
            chunk = os.read(read_fd, 4096)
            if not chunk:
                break
            data += chunk
        os.close(read_fd)
        print(f"Parent (PID: {os.getpid()}) received: {data.decode()}", end="")
        child_pid, status = os.wait()
        exit_code = os.waitstatus_to_exitcode(status)
        print(f"Child {child_pid} exited with code {exit_code}")

if __name__ == "__main__":
    main()
```

</details>

---

### Challenge 3: Signal Handling

*Estimated time: 15 minutes*

Write a bash script that creates a temp directory, installs a `trap` cleanup handler for
SIGTERM, SIGINT, and EXIT, then sleeps. Test it by sending SIGTERM (cleanup runs),
SIGKILL (cleanup does NOT run, temp dir leaks), and SIGINT (cleanup runs). Record the
exit code for each and explain why they differ.

<details>
<summary>Script template</summary>

```bash
#!/usr/bin/env bash
TMPDIR=$(mktemp -d)
printf 'PID: %s\nTemp dir: %s\n' "$$" "$TMPDIR"

printf 'data\n' > "$TMPDIR/file1.txt"
printf 'data\n' > "$TMPDIR/file2.txt"

cleanup() {
  printf 'Cleaning up %s\n' "$TMPDIR"
  rm -rf "$TMPDIR"
}
trap cleanup SIGTERM SIGINT EXIT

printf 'Working... (send me a signal)\n'
sleep 60
```

Expected exit codes: SIGTERM = 143 (128+15), SIGKILL = 137 (128+9), SIGINT = 130 (128+2).

</details>

---

### Challenge 4: Pipeline Failure Modes

*Estimated time: 15 minutes*

Demonstrate that `set -e` does not catch pipeline failures, then show how `set -eo pipefail` fixes it, then use `${PIPESTATUS[@]}` to identify which stage of a three-stage pipeline failed.

<details>
<summary>Key demonstration</summary>

```bash
#!/usr/bin/env bash
set -e

# This does NOT exit the script
false | true
printf 'Script continued past the pipeline\n'

# But this does:
false
printf 'Never reached\n'
```

With `set -eo pipefail`, the `false | true` line exits the script because `false`'s
non-zero exit code propagates through pipefail.

</details>

---

### Challenge 5: Zombie Creation and Reaping

*Estimated time: 15 minutes*

Write a Python script that forks a child, lets the child exit immediately, and does NOT
call `wait()`. Observe the zombie with `ps aux | grep Z`. Then modify the script to
reap the zombie after 10 seconds and observe it disappear.

---

### Challenge 6: fd Detective

*Estimated time: 15 minutes*

Start a Python HTTP server (`python3 -m http.server 9876`), then use `/proc/$PID/fd/`
and `lsof -p $PID` to identify all its open file descriptors. Make a curl request and
observe the new connection fd appear. Write a bash function `fd_report()` that takes
a PID and categorises all fds by type (file, pipe, socket, device).

---

## Key Takeaways

Before moving to Step 2, you should be able to answer these from memory:

1. What is a process, structurally?
2. Why does Unix split process creation into fork() and exec()?
3. What is a file descriptor?
4. When the shell executes `cmd1 | cmd2`, what syscalls occur?
5. What is the difference between SIGTERM and SIGKILL?
6. What is a zombie process?
7. Why does `set -e` not catch pipeline failures?
8. What exit code does a process killed by SIGKILL have?
9. Why does `echo "value" | tool` differ from `printf 'value' | tool`?
10. If `curl` fails in `curl url | jq '.field'`, what does `$?` report?

---

## Recommended Reading

- **The Design of the UNIX Operating System** - Maurice Bach (1986). Chapters 7 and 10.
- **Advanced Programming in the UNIX Environment** - Stevens and Rago (3rd ed, 2013). Chapters 3, 8, and 10.
- **The Unix Programming Environment** - Kernighan and Pike (1984). Chapter 7.
- **`man 2 fork`**, **`man 2 exec`**, **`man 2 pipe`**, **`man 7 signal`** - the actual specifications.
- **McIlroy's pipe memo** (1964) - the document that led to pipes in Unix.

---

## What to Read Next

**[Step 2: The Shell Language](/bootcamp/02-shell-language/)** - Bash is not a scripting language bolted onto a terminal.
It is a process launcher with a programming language bolted on. Every concept in Step 2
is built on the process model from Step 1. The shell's job is to call fork(), exec(),
pipe(), dup2(), and wait() - the "scripting" is the control flow that decides which
syscalls to make and in what order.
