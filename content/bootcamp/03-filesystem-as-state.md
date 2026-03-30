+++
title = "The Filesystem as State"
date = "2026-03-10"
description = "Paths, permissions, inodes, /proc, /sys - the agent's working memory is the filesystem."
tags = ["filesystem", "linux", "permissions", "proc", "bootcamp"]
step = 3
tier = 1
estimate = "4-6 hours"
bootcamp = 1
+++

Step 3 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model), Step 2 (shell language)
**Leads to:** Step 4 (text pipeline), Step 7 (git internals)

---

## Why This Step Exists

The agent's working memory IS the filesystem. Every file the agent reads, writes, creates,
or deletes is a state change. Every `.done/` marker in a Makefile, every YAML config, every
git object, every lockfile - all of it lives on a filesystem. If the Operator cannot reason
about file state, the Operator cannot verify agent output. This step builds the mental model
that makes verification possible.

The agent-native taxonomy established two principles that converge here:
- **Principle 3:** State is explicit and inspectable.
- **Principle 7:** The filesystem is the workspace.

Both reduce to the same insight: if you can `ls`, `stat`, `cat`, and `diff` the state, you
can verify it. If you cannot, you are trusting blindly.

---

## Table of Contents

1. [Everything Is a File (Descriptor)](#1-everything-is-a-file-descriptor) (~30 min)
2. [Inodes and the Directory Abstraction](#2-inodes-and-the-directory-abstraction) (~45 min)
3. [The Path Resolution Algorithm](#3-the-path-resolution-algorithm) (~30 min)
4. [The Permissions Model](#4-the-permissions-model) (~45 min)
5. [The /proc Filesystem](#5-the-proc-filesystem) (~45 min)
6. [The /sys Filesystem](#6-the-sys-filesystem) (~15 min)
7. [Temporary Files and Atomic Operations](#7-temporary-files-and-atomic-operations) (~30 min)
8. [Mount Points and Filesystem Layers](#8-mount-points-and-filesystem-layers) (~30 min)
9. [File Locking and Concurrency](#9-file-locking-and-concurrency) (~30 min)
10. [Challenges](#challenge-inode-detective) (~60-90 min)

---

## 1. Everything Is a File (Descriptor)

**Estimated time: 30 minutes**

Unix has one dominant abstraction: the file. Nearly everything in the system - regular
files, directories, devices, network sockets, kernel data structures, hardware interfaces -
is exposed through a file-like interface that supports some subset of `open`, `read`,
`write`, `close`, and `ioctl`.

This is not a slogan. It is an engineering decision with structural consequences.

### The file types

| Type | Example | How to identify | Purpose |
|------|---------|----------------|---------|
| Regular file | `/etc/passwd` | `ls -l` shows `-` | Data storage |
| Directory | `/home/` | `ls -l` shows `d` | Contains (name, inode) pairs |
| Symbolic link | `/usr/bin/python3 -> python3.11` | `ls -l` shows `l` | Path indirection |
| Block device | `/dev/sda` | `ls -l` shows `b` | Disk-like I/O (random access) |
| Character device | `/dev/null`, `/dev/urandom` | `ls -l` shows `c` | Stream I/O (sequential) |
| Named pipe (FIFO) | created with `mkfifo` | `ls -l` shows `p` | IPC between processes |
| Socket | `/var/run/docker.sock` | `ls -l` shows `s` | IPC (bidirectional) |

### Why it matters for composition

Because devices are files, you can compose them with the same tools you use for regular
files:

```bash
# Treat a device as a data source, pipe through standard tools
cat /dev/urandom | head -c 16 | base64

# /dev/null absorbs output - it is a file that discards all writes
command-that-is-noisy 2>/dev/null

# /dev/stdin, /dev/stdout, /dev/stderr are files pointing to fd 0, 1, 2
cat /dev/stdin   # equivalent to cat - (reads from stdin)

# A named pipe is a file that connects two processes
mkfifo /tmp/mypipe
echo "hello" > /tmp/mypipe &   # blocks until reader connects
cat /tmp/mypipe                 # reads "hello", both sides unblock
rm /tmp/mypipe
```

The composition model from Step 1 (pipes connecting stdout to stdin) works precisely because
devices and streams share the file interface. `head` does not know it is reading from
`/dev/urandom` - it sees a file descriptor that supports `read()`.

### File descriptors revisited

From Step 1 you know that every process gets three open file descriptors at birth: 0
(stdin), 1 (stdout), 2 (stderr). Each is an integer index into the process's file
descriptor table, which the kernel maintains. The table maps integers to open file
descriptions (the kernel's bookkeeping for an open file).

You can see a process's open file descriptors at any time:

```bash
# Your own shell's file descriptors
ls -la /proc/self/fd/

# A specific process's file descriptors
ls -la /proc/1234/fd/
```

Each entry in `/proc/self/fd/` is a symlink showing what the descriptor points to - a
regular file, a pipe, a socket, a device.

> **AGENTIC GROUNDING:** When an agent opens files, spawns subprocesses, or creates pipes,
> it is manipulating file descriptors. A resource leak (opening files without closing them)
> eventually hits the per-process file descriptor limit (`ulimit -n`, typically 1024). An
> agent orchestrating many parallel operations can hit this limit. Diagnosing it requires
> inspecting `/proc/<pid>/fd/` - which is itself a filesystem operation.

> **HISTORY:** "Everything is a file" is attributed to the Unix design philosophy of
> Thompson and Ritchie (1970s), but Unix did not fully deliver on it. Network connections
> required special system calls (`socket`, `bind`, `connect`) rather than `open`. Plan 9
> from Bell Labs (1992) took the principle to its logical conclusion: network connections
> are files, the window system is a filesystem (`/dev/draw`), even remote machines are
> mounted as directory trees. Modern Linux recovers some of this through `/proc` and `/sys`.

---

## 2. Inodes and the Directory Abstraction

**Estimated time: 45 minutes**

A filename is not a file. A filename is a pointer to a file. Understanding this distinction
is fundamental to reasoning about filesystem state.

### What is an inode?

An **inode** (index node) is the kernel's data structure for a file. It contains:

- File type (regular, directory, symlink, etc.)
- Permissions (owner, group, mode)
- Owner (UID, GID)
- Size in bytes
- Timestamps (atime, mtime, ctime - access, modify, change)
- Number of hard links pointing to this inode
- Pointers to data blocks on disk

What the inode does NOT contain: the filename. The name lives in the directory.

### What is a directory?

A directory is a file whose content is a list of (name, inode number) pairs. That is all.

```
Directory inode 100 contains:
  "."     -> inode 100  (self-reference)
  ".."    -> inode 50   (parent directory)
  "foo.txt" -> inode 201
  "bar/"    -> inode 202
```

You can see inode numbers with `ls -i`:

```bash
$ ls -i
201 foo.txt
202 bar
```

And get the full inode metadata with `stat`:

```bash
$ stat foo.txt
  File: foo.txt
  Size: 42            Blocks: 8          IO Block: 4096   regular file
Device: 0,50          Inode: 201         Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/  agent)   Gid: ( 1000/  agent)
Access: 2026-03-10 10:00:00.000000000 +0000
Modify: 2026-03-10 09:30:00.000000000 +0000
Change: 2026-03-10 09:30:00.000000000 +0000
 Birth: 2026-03-10 09:30:00.000000000 +0000
```

### Hard links

Because a filename is just a (name, inode) entry in a directory, you can have multiple
names pointing to the same inode. These are **hard links**.

```bash
# Create a file
echo "hello" > original.txt
ls -i original.txt
# 201 original.txt

# Create a hard link - a second name for the same inode
ln original.txt hardlink.txt
ls -i original.txt hardlink.txt
# 201 hardlink.txt
# 201 original.txt

# Same inode number. stat shows Links: 2
stat original.txt | grep Links
# Links: 2

# Modify through one name, read through the other
echo "modified" > hardlink.txt
cat original.txt
# modified

# Delete the original - the inode survives because link count > 0
rm original.txt
cat hardlink.txt
# modified
stat hardlink.txt | grep Links
# Links: 1
```

The file (inode) is only deleted when the link count drops to zero AND no process has it
open. This is why you can delete a log file while a process is still writing to it - the
process holds an open file descriptor, so the inode persists until the process closes it.

### Symbolic links

A **symlink** is a different kind of file entirely. It is a file whose content is a path
string. When the kernel encounters a symlink during path resolution, it reads the path
string and continues resolving from there.

```bash
# Create a symlink
ln -s /home/agent/original.txt symlink.txt

# The symlink is its own inode, containing the path "/home/agent/original.txt"
ls -i symlink.txt original.txt
# 305 symlink.txt    <-- different inode
# 201 original.txt

# If the target is deleted, the symlink breaks (dangling symlink)
rm original.txt
cat symlink.txt
# cat: symlink.txt: No such file or directory

# The symlink still exists - it just points to nothing
ls -l symlink.txt
# lrwxrwxrwx 1 agent agent 27 Mar 10 10:00 symlink.txt -> /home/agent/original.txt
```

Key differences:

| Property | Hard link | Symbolic link |
|----------|-----------|---------------|
| Same inode as target? | Yes | No (own inode) |
| Survives target deletion? | Yes | No (becomes dangling) |
| Can cross filesystem boundaries? | No | Yes |
| Can link to directories? | No (usually) | Yes |
| Content | Not applicable (IS the file) | A path string |

### Why `mv` within a filesystem is instant

Now the punchline. `mv` within the same filesystem does not copy data. It creates a new
directory entry (name, inode) in the destination directory and removes the old entry from
the source directory. The inode - and all the data blocks it points to - never moves.

```bash
# Moving a 10GB file on the same filesystem: instant
time mv /data/huge-file.bin /data/archive/huge-file.bin
# real    0m0.001s

# Moving across filesystems: copies all data, then deletes
time mv /data/huge-file.bin /mnt/external/huge-file.bin
# real    0m45.000s  (depends on file size and disk speed)
```

This is not a performance trick. It is a structural consequence of the inode model. And it
is the foundation of atomic file writes, covered in section 7.

> **AGENTIC GROUNDING:** Git is built on this model. A git object (blob, tree, commit) is
> a file named by its SHA-1/SHA-256 hash, stored in `.git/objects/`. The index
> (`.git/index`) maps pathnames to blob hashes. `git write-tree` - used in this project's
> Makefile to compute a tree identity - creates a tree object from the index. Git is a
> content-addressable filesystem layered on top of the regular filesystem. Step 7 builds
> on this foundation.

> **HISTORY:** The inode concept comes from the original Unix filesystem designed by Ken
> Thompson and Dennis Ritchie in the early 1970s. The name is short for "index node."
> Ritchie's decision to make directories just files containing (name, inode) pairs is an
> elegant recursion: the tool that navigates the tree (the kernel's path resolution) uses
> the same `read()` interface it uses for everything else.

---

## 3. The Path Resolution Algorithm

**Estimated time: 30 minutes**

When you access `/home/agent/code/file.txt`, the kernel does not look up the path as a
single string. It resolves it component by component. Understanding this algorithm makes
many puzzling filesystem behaviours obvious.

### Step by step

Given the path `/home/agent/code/file.txt`:

1. Start at the **root inode** (inode 2 by convention on ext4).
2. Read the root directory's data. Find the entry named `home`. It maps to inode 500.
3. Check permissions: does the current user have **execute** permission on inode 2 (the root
   directory)? Execute on a directory means "traverse" - the right to resolve names within
   it. If no, stop with `EACCES`.
4. Read inode 500 (the `/home` directory). Find the entry named `agent`. It maps to inode
   600.
5. Check execute permission on inode 500. Continue.
6. Read inode 600 (`/home/agent`). Find `code` -> inode 700.
7. Check execute permission on inode 600. Continue.
8. Read inode 700 (`/home/agent/code`). Find `file.txt` -> inode 800.
9. Check execute permission on inode 700. Continue.
10. Return inode 800. The caller now has access to the file's metadata and data.

### Symlink resolution

If at any step the inode found is a symbolic link, the kernel reads the symlink's content
(a path string) and restarts resolution from that path. If the symlink contains an absolute
path, resolution starts from root. If relative, resolution continues from the current
directory in the walk.

The kernel imposes a limit on symlink depth (typically 40 on Linux) to prevent infinite
loops from circular symlinks.

```bash
# Create a circular symlink
ln -s b a
ln -s a b
cat a
# cat: a: Too many levels of symbolic links
```

### Relative paths and `.` / `..`

- `.` is a hard link every directory has to itself.
- `..` is a hard link every directory has to its parent.
- A relative path is resolved starting from the process's current working directory
  (`/proc/self/cwd`).

```bash
# See where . and .. point
ls -ia /home/agent/code/
# 700 .
# 600 ..
# 800 file.txt
```

### Useful tools

```bash
# Resolve a path to its absolute, canonical form (resolving all symlinks)
realpath ./some/relative/../path/with/symlinks

# Follow a symlink chain to its target
readlink -f /usr/bin/python3

# Show the canonical working directory (resolves symlinks in $PWD)
pwd -P
```

### Why this matters

An agent may:
- Create a symlink to a path that does not exist yet (the link succeeds, but access
  through it fails until the target is created).
- Create a circular symlink accidentally (two config files symlinking to each other).
- Fail to access a file not because of the file's permissions but because of a missing
  execute bit on a parent directory.
- Produce different behaviour depending on whether it uses an absolute or relative path
  (because the working directory changed).

All of these are path resolution issues. The algorithm above explains every case.

> **AGENTIC GROUNDING:** This project uses symlinks for harness compatibility: `CLAUDE.md`
> is a symlink to `AGENTS.md`. If an agent creates or modifies `CLAUDE.md` directly instead
> of following the symlink, it creates a divergence - two files where there should be one.
> Understanding path resolution means understanding that `cat CLAUDE.md` follows the
> symlink (reads `AGENTS.md`), but `ls -l CLAUDE.md` shows the symlink itself.

---

## 4. The Permissions Model

**Estimated time: 45 minutes**

Every inode carries a permissions mask that determines who can do what. The model is
simple in structure but has subtleties that cause real problems when misunderstood.

### The three axes

Permissions are specified for three categories of user:

- **User (u):** The file's owner.
- **Group (g):** Members of the file's group.
- **Other (o):** Everyone else.

Each category has three permission bits:

| Bit | On a file | On a directory |
|-----|-----------|----------------|
| **r** (read) | Read file contents | List directory contents (`ls`) |
| **w** (write) | Modify file contents | Create/delete entries in directory |
| **x** (execute) | Execute as program | Traverse (cd into, resolve names within) |

### The directory execute bit

This is the subtlety that catches people. The `x` bit on a directory controls **traversal**
- the right to resolve names within that directory.

```bash
mkdir testdir
echo "secret" > testdir/file.txt

# Remove execute from the directory
chmod a-x testdir

# You can list the directory (r bit is still set)
ls testdir
# file.txt

# But you cannot access the file inside (no x bit = no name resolution)
cat testdir/file.txt
# cat: testdir/file.txt: Permission denied

# You cannot cd into it either
cd testdir
# bash: cd: testdir: Permission denied

# Restore execute
chmod a+x testdir
```

Conversely, if a directory has `x` but not `r`:

```bash
chmod a-r,a+x testdir

# You cannot list the directory contents
ls testdir
# ls: cannot open directory 'testdir': Permission denied

# But if you KNOW the filename, you can access it (x allows name resolution)
cat testdir/file.txt
# secret
```

### Numeric notation

Permissions are encoded as a three-digit octal number, one digit per category:

```
r=4, w=2, x=1

  user  group  other
  rwx   r-x    r-x
  7     5      5     = 755

  rw-   r--    r--
  6     4      4     = 644
```

Common patterns:

| Mode | Meaning | Typical use |
|------|---------|-------------|
| `755` | Owner: rwx, Group: rx, Other: rx | Executable files, directories |
| `644` | Owner: rw, Group: r, Other: r | Regular files |
| `700` | Owner: rwx, nobody else | Private directories |
| `600` | Owner: rw, nobody else | Private files (SSH keys, secrets) |
| `777` | Everyone: rwx | Almost never correct |

### chmod, chown, chgrp

```bash
# Symbolic notation
chmod u+x script.sh         # add execute for owner
chmod go-w config.yaml       # remove write for group and other
chmod a+r public.html        # add read for all

# Numeric notation
chmod 755 script.sh
chmod 644 config.yaml

# Change owner
chown agent:developers file.txt   # set user and group
chown -R agent:developers dir/    # recursive

# Change group only
chgrp developers file.txt
```

### umask

The **umask** is a per-process mask that determines the default permissions for newly
created files. It works by subtracting bits:

```bash
# Check current umask
umask
# 0022

# Default for new files: 666 - 022 = 644 (rw-r--r--)
touch newfile.txt
stat -c '%a' newfile.txt
# 644

# Default for new directories: 777 - 022 = 755 (rwxr-xr-x)
mkdir newdir
stat -c '%a' newdir
# 755

# Set a more restrictive umask
umask 077
touch private.txt
stat -c '%a' private.txt
# 600
```

### Special bits: setuid, setgid, sticky

These are the fourth octal digit (or special symbolic flags):

| Bit | Numeric | On a file | On a directory |
|-----|---------|-----------|----------------|
| setuid | 4 | Execute as the file's owner (not the caller) | (no effect) |
| setgid | 2 | Execute as the file's group | New files inherit the directory's group |
| sticky | 1 | (no effect) | Only file owner can delete their files |

```bash
# setuid example: passwd runs as root regardless of who calls it
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root ... /usr/bin/passwd
#    ^ the 's' means setuid is set

# sticky bit: /tmp allows everyone to write, but you can only delete your own files
ls -ld /tmp
# drwxrwxrwt ...
#          ^ the 't' means sticky bit is set

# Set setuid (use with extreme caution)
chmod 4755 program
# Set sticky bit
chmod 1777 shared-dir
```

> **AGENTIC GROUNDING:** When an agent generates a shell script, it must set the execute
> bit (`chmod +x`) or the script will not be runnable. When an agent writes sensitive files
> (API keys, credentials), it should use mode `600` to prevent other users from reading
> them. When an agent creates a shared directory, the sticky bit prevents one agent's
> output from being deleted by another. These are not academic concerns - they are the
> permission model that governs every file operation the agent performs.

---

## 5. The /proc Filesystem

**Estimated time: 45 minutes**

`/proc` is a virtual filesystem - it does not exist on disk. It is generated on the fly by
the kernel to expose internal data structures as files. Reading `/proc/meminfo` does not
read a disk block. It invokes a kernel function that formats the current memory statistics
into text and returns it.

This is the "everything is a file" philosophy applied to the kernel itself.

### Per-process information: /proc/[pid]/

Every running process gets a directory under `/proc/` named by its PID:

```bash
# Your own process information
ls /proc/self/

# Or by PID
ls /proc/1234/
```

The most useful entries:

| Path | Contents | Example |
|------|----------|---------|
| `/proc/self/cmdline` | Null-separated command line args | `cat /proc/self/cmdline \| tr '\0' ' '` |
| `/proc/self/environ` | Null-separated environment variables | `cat /proc/self/environ \| tr '\0' '\n'` |
| `/proc/self/cwd` | Symlink to current working directory | `readlink /proc/self/cwd` |
| `/proc/self/exe` | Symlink to the executable | `readlink /proc/self/exe` |
| `/proc/self/fd/` | Directory of open file descriptors | `ls -la /proc/self/fd/` |
| `/proc/self/maps` | Memory mappings (shared libs, heap, stack) | Shows loaded `.so` files |
| `/proc/self/status` | Human-readable process status | PID, state, memory, threads |
| `/proc/self/limits` | Resource limits (open files, stack, etc.) | Compare with `ulimit` |

```bash
# See all open file descriptors of a running process
ls -la /proc/$(pgrep -f "node server")/fd/

# Check if a process is alive by testing its /proc directory
if [ -d /proc/1234 ]; then
  echo "Process 1234 is alive"
fi

# Get a process's working directory
readlink /proc/1234/cwd

# Get a process's environment (useful for debugging)
cat /proc/1234/environ | tr '\0' '\n' | grep PATH
```

### System-wide information

| Path | Contents |
|------|----------|
| `/proc/cpuinfo` | CPU model, cores, features |
| `/proc/meminfo` | Total, free, available, cached memory |
| `/proc/loadavg` | Load averages (1, 5, 15 min) and running/total processes |
| `/proc/uptime` | Seconds since boot, idle seconds |
| `/proc/version` | Kernel version string |
| `/proc/filesystems` | Filesystem types the kernel supports |
| `/proc/mounts` | Currently mounted filesystems (same as `mount` output) |

```bash
# Quick system health check - all from /proc, no external tools
printf "CPUs:    %s\n" "$(grep -c ^processor /proc/cpuinfo)"
printf "Memory:  %s\n" "$(grep MemAvailable /proc/meminfo)"
printf "Load:    %s\n" "$(cat /proc/loadavg)"
printf "Uptime:  %s seconds\n" "$(cut -d' ' -f1 /proc/uptime)"
```

### Tuneable parameters: /proc/sys/

The `/proc/sys/` hierarchy exposes kernel parameters that can be read and (with
appropriate permissions) written at runtime:

```bash
# Maximum number of open file descriptors system-wide
cat /proc/sys/fs/file-max
# 9223372036854775807

# Maximum number of open files per process (different from ulimit)
cat /proc/sys/fs/nr_open

# Network parameters
cat /proc/sys/net/ipv4/ip_forward
# 0 = routing disabled, 1 = enabled

# Write to change at runtime (requires root)
echo 1 > /proc/sys/net/ipv4/ip_forward

# Persistent changes go through sysctl
sysctl -w net.ipv4.ip_forward=1
```

### The key insight

`/proc` turns kernel introspection into file reads. This means every tool that works with
files - `cat`, `grep`, `awk`, shell redirection - works with kernel data. No special APIs,
no special libraries. The file abstraction provides the interface.

> **AGENTIC GROUNDING:** When an agent needs to check if a process is running, it can test
> for the existence of `/proc/<pid>/` or use `kill -0 <pid>`. Both are filesystem
> operations at heart. The Makefile in this project monitors polecat processes for liveness.
> Debugging a stuck agent process means examining `/proc/<pid>/fd/` (what files does it
> have open?), `/proc/<pid>/status` (is it sleeping? zombie?), and `/proc/<pid>/maps`
> (what libraries are loaded?). All readable without attaching a debugger.

---

## 6. The /sys Filesystem

**Estimated time: 15 minutes**

`/sys` (sysfs) is another virtual filesystem, introduced in Linux 2.6. Where `/proc` grew
organically and contains a mix of process information and kernel tunables, `/sys` has a
more structured layout focused on devices, drivers, and hardware.

### Structure

```bash
/sys/
├── block/           # Block devices (sda, nvme0n1, etc.)
├── bus/             # Devices organized by bus type (pci, usb, etc.)
├── class/           # Devices organized by class
│   ├── net/         # Network interfaces
│   ├── block/       # Block devices (another view)
│   ├── tty/         # Terminal devices
│   └── ...
├── devices/         # The device tree (physical topology)
├── firmware/        # Firmware interfaces (ACPI, etc.)
├── fs/              # Filesystem parameters
├── kernel/          # Kernel subsystem parameters
├── module/          # Loaded kernel modules
└── power/           # Power management
```

### Practical examples

```bash
# List network interfaces
ls /sys/class/net/
# eth0  lo  wlan0

# Get the MAC address of an interface
cat /sys/class/net/eth0/address
# aa:bb:cc:dd:ee:ff

# Check if an interface is up
cat /sys/class/net/eth0/operstate
# up

# List block devices and their sizes
for dev in /sys/block/*/; do
  printf "%s: %s bytes\n" "$(basename "$dev")" "$(cat "$dev/size")"
done

# Check battery status (laptops)
cat /sys/class/power_supply/BAT0/status
# Charging
cat /sys/class/power_supply/BAT0/capacity
# 73
```

### When does this matter?

For most agentic work, `/sys` is less immediately relevant than `/proc`. You will not
interact with it daily. But it completes the picture: regular files store data, `/proc`
exposes processes and kernel state, `/sys` exposes hardware and device state. Together,
they make nearly the entire system inspectable through the file interface.

Where `/sys` becomes directly relevant is in container and device work - understanding what
hardware a container can see, checking disk health, or diagnosing network interface state.

> **AGENTIC GROUNDING:** If an agent needs to determine available disk space, network
> interface status, or hardware capabilities, the answer lives in `/sys`. An agent
> provisioning a container might check `/sys/fs/cgroup/` to understand resource limits.
> The pattern is always the same: read a file, get state.

---

## 7. Temporary Files and Atomic Operations

**Estimated time: 30 minutes**

This section has direct, daily relevance to agentic work. Every time an agent writes a
config file, updates a YAML document, or modifies state, the question is: what happens if
the write is interrupted?

### Temp directories

| Directory | Cleared on reboot? | Typical use |
|-----------|--------------------|-------------|
| `/tmp` | Yes | Short-lived scratch files |
| `/var/tmp` | No | Files that should survive reboot |

### Safe temp file creation

Never construct temp filenames manually. Use `mktemp`:

```bash
# Create a temp file (name includes random characters to prevent collisions)
tmpfile=$(mktemp)
echo "$tmpfile"
# /tmp/tmp.aB3xK9pQzR

# Create a temp file with a template
tmpfile=$(mktemp /tmp/myapp.XXXXXX)
echo "$tmpfile"
# /tmp/myapp.7Hk2mN

# Create a temp directory
tmpdir=$(mktemp -d)
echo "$tmpdir"
# /tmp/tmp.Rz9wQ1xYpL

# Clean up on exit (use trap from Step 2)
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT
```

Why `mktemp` and not `touch /tmp/myfile.$$`? The PID-based approach has a race condition:
another process could predict or reuse the PID, creating a file at that path between your
check and your create. `mktemp` uses `O_EXCL` to atomically create the file only if it does
not exist.

### The atomic write pattern

The single most important filesystem pattern for safe state updates:

```bash
# WRONG: Direct write. If killed mid-write, file is corrupted.
echo "$new_content" > config.yaml

# RIGHT: Write to temp, then rename.
tmpfile=$(mktemp config.yaml.XXXXXX)
echo "$new_content" > "$tmpfile"
mv "$tmpfile" config.yaml
```

Why does this work? Recall from section 2: `mv` within a filesystem is a directory entry
rename - an atomic operation. The target file (`config.yaml`) either has the old content
or the new content. Never a partial write. Never corruption.

The full pattern with error handling:

```bash
atomic_write() {
  local target="$1"
  local content="$2"
  local dir
  dir=$(dirname "$target")

  # Create temp in the SAME directory (ensures same filesystem)
  local tmpfile
  tmpfile=$(mktemp "$dir/.tmp.XXXXXX")

  # Write content. If this fails, the temp file is incomplete - but
  # the target is untouched.
  if ! printf '%s' "$content" > "$tmpfile"; then
    rm -f "$tmpfile"
    return 1
  fi

  # Preserve permissions of original file if it exists
  if [ -f "$target" ]; then
    chmod --reference="$target" "$tmpfile" 2>/dev/null
  fi

  # Atomic rename. This is the commit point.
  mv "$tmpfile" "$target"
}
```

Critical detail: the temp file must be on the **same filesystem** as the target. If they
are on different filesystems, `mv` falls back to copy-and-delete, which is not atomic.
Creating the temp file in the same directory guarantees same-filesystem.

### Python equivalent

```python
import os
import tempfile

def atomic_write(target: str, content: str) -> None:
    """Write content to target atomically using temp+rename."""
    target_dir = os.path.dirname(os.path.abspath(target))

    # Create temp file in same directory as target
    fd, tmp_path = tempfile.mkstemp(dir=target_dir, prefix='.tmp.')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())  # Force write to disk
        os.replace(tmp_path, target)  # Atomic rename (POSIX)
    except:
        os.unlink(tmp_path)  # Clean up on failure
        raise
```

Note `os.replace()` instead of `os.rename()`. On POSIX systems they are equivalent, but
`os.replace()` is guaranteed to atomically replace the target even on Windows.

Note `os.fsync()`. Without it, the kernel may buffer the write. If the system crashes
between `write()` and the actual disk write, the temp file may be empty or partial. `fsync`
forces the data to disk before the rename.

> **AGENTIC GROUNDING:** When an agent updates `backlog.yaml`, `events.yaml`, or any YAML
> config in this project, a crash mid-write would leave the file in a broken state - half
> old YAML, half new, unparseable. The atomic write pattern prevents this. The Operator
> verifies agent output by reading these files; if the files are corrupt, verification is
> impossible. Every agent that writes state files should use atomic writes. This is not
> defensive programming - it is the minimum standard for reliable state management.

---

## 8. Mount Points and Filesystem Layers

**Estimated time: 30 minutes**

The filesystem tree you see is not one filesystem. It is multiple filesystems grafted onto a
single tree at **mount points**. Understanding this is essential for container work and for
knowing where your data actually lives.

### Viewing mounts

```bash
# List all mount points (the modern way)
findmnt

# The traditional way
mount

# Check what filesystem a path is on
df /home/agent/code/
# Filesystem     1K-blocks    Used Available Use% Mounted on
# /dev/sda1      102400000 45000000  57400000  44% /

# More detail about a specific mount
findmnt /home
```

### Key filesystem types

| Type | Where it lives | Properties |
|------|---------------|------------|
| ext4 | Disk | Standard Linux filesystem, journaled |
| xfs | Disk | High-performance, used by RHEL/CentOS |
| btrfs | Disk | Copy-on-write, snapshots, compression |
| tmpfs | RAM | Fast, ephemeral (gone on reboot/unmount) |
| proc | Kernel | Virtual, process information |
| sysfs | Kernel | Virtual, device information |
| overlayfs | Other filesystems | Union mount - layers multiple fs |
| nfs | Network | Remote filesystem |

### tmpfs - a filesystem in RAM

```bash
# Mount a tmpfs (requires root or appropriate namespace)
mount -t tmpfs -o size=100M tmpfs /mnt/ramdisk

# Files here are in RAM - fast, but gone when unmounted or rebooted
echo "fast" > /mnt/ramdisk/data.txt
cat /mnt/ramdisk/data.txt
# fast

# /tmp is often a tmpfs
findmnt /tmp
# TARGET SOURCE FSTYPE OPTIONS
# /tmp   tmpfs  tmpfs  rw,...
```

### Bind mounts

A bind mount makes a directory available at a second location in the tree:

```bash
# Mount /data/shared at /home/agent/shared
mount --bind /data/shared /home/agent/shared

# Same files, two paths
ls /data/shared
ls /home/agent/shared
# identical output
```

Bind mounts are how Docker exposes host directories inside containers (`-v` flag).

### overlayfs - the Docker filesystem

overlayfs layers a writable filesystem on top of one or more read-only layers. This is
exactly how Docker images work.

```
┌─────────────────────┐
│   Container layer    │  (writable - upperdir)
├─────────────────────┤
│   Image layer 3      │  (read-only)
├─────────────────────┤
│   Image layer 2      │  (read-only)
├─────────────────────┤
│   Image layer 1      │  (read-only - lowerdir)
└─────────────────────┘
         ↓
┌─────────────────────┐
│   Merged view        │  (what the container sees)
└─────────────────────┘
```

When the container reads a file, overlayfs looks through the layers top-down and returns
the first match. When the container writes a file, the write goes to the top (writable)
layer. The read-only layers are never modified.

```bash
# Manual overlayfs mount (requires root)
mkdir -p /tmp/lower /tmp/upper /tmp/work /tmp/merged

echo "from lower" > /tmp/lower/file.txt

mount -t overlay overlay \
  -o lowerdir=/tmp/lower,upperdir=/tmp/upper,workdir=/tmp/work \
  /tmp/merged

# Read sees the lower layer
cat /tmp/merged/file.txt
# from lower

# Write creates a copy in upper layer (copy-on-write)
echo "modified" > /tmp/merged/file.txt
cat /tmp/merged/file.txt
# modified

# Lower layer is untouched
cat /tmp/lower/file.txt
# from lower

# The modification lives in the upper layer
cat /tmp/upper/file.txt
# modified
```

When the container is destroyed, the upper (writable) layer is deleted. All writes
disappear. This is why Docker volumes exist - to persist data outside the container's
overlayfs stack.

> **AGENTIC GROUNDING:** When an agent runs inside a Docker container and writes files, those
> files exist in the container's writable overlay layer. If the container is destroyed, the
> files are gone. This is why development containers use volume mounts for source code -
> the code lives on the host filesystem, bind-mounted into the container. Understanding
> this prevents the Operator from losing work when a container exits. Step 9 (container
> internals) builds directly on these concepts.

---

## 9. File Locking and Concurrency

**Estimated time: 30 minutes**

When multiple processes (or multiple agents) write to the same file, the results without
coordination are unpredictable. File locking provides mutual exclusion.

### The problem

```bash
# Two processes appending to the same file simultaneously
# Process A
echo "line from A" >> shared.log &

# Process B
echo "line from B" >> shared.log &

wait

# Usually fine for small appends (atomic up to PIPE_BUF on pipes, usually
# safe for small writes to regular files). But for larger or structured writes
# (like modifying a YAML file), interleaving is not just possible - it is
# guaranteed to corrupt the file.
```

### Advisory locks with flock

Linux provides advisory file locks through `flock(2)`. "Advisory" means the kernel does
not enforce the lock - all cooperating processes must agree to check the lock. A process
that ignores the lock can write freely.

In shell scripts, `flock` is the tool:

```bash
# Exclusive lock - only one holder at a time
flock /tmp/myapp.lock -c "echo 'critical section'; sleep 5"

# From another terminal (this blocks until the lock is released):
flock /tmp/myapp.lock -c "echo 'my turn'"

# Non-blocking: fail immediately if lock is held
flock -n /tmp/myapp.lock -c "echo 'got it'" || echo "lock is held"

# Shared lock (multiple readers, exclusive for writers)
flock -s /tmp/myapp.lock -c "cat data.txt"
```

### flock in scripts - the fd pattern

For more control, use flock with a file descriptor:

```bash
#!/bin/bash
# Open the lock file on fd 9
exec 9>/tmp/myapp.lock

# Acquire exclusive lock (blocks until available)
flock 9

# Critical section - safe from concurrent access
echo "$(date): update" >> /var/log/myapp.log

# Lock is released when fd 9 is closed (script exit, or exec 9>&-)
exec 9>&-
```

### Python locking

```python
import fcntl

def with_file_lock(lock_path: str):
    """Context manager for file-based locking."""
    lock_fd = open(lock_path, 'w')
    fcntl.flock(lock_fd, fcntl.LOCK_EX)
    try:
        yield
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()

# Usage
import contextlib

@contextlib.contextmanager
def file_lock(lock_path: str):
    lock_fd = open(lock_path, 'w')
    fcntl.flock(lock_fd, fcntl.LOCK_EX)
    try:
        yield
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()

with file_lock('/tmp/myapp.lock'):
    # Critical section
    update_yaml_file('config.yaml')
```

### Combining locks with atomic writes

The robust pattern for concurrent state updates:

```bash
update_config() {
  local target="$1"
  local new_value="$2"

  # 1. Acquire lock
  exec 9>"$target.lock"
  flock 9

  # 2. Read current state
  local current
  current=$(cat "$target")

  # 3. Compute new state
  local updated
  updated=$(echo "$current" | modify_somehow "$new_value")

  # 4. Atomic write
  local tmpfile
  tmpfile=$(mktemp "$(dirname "$target")/.tmp.XXXXXX")
  printf '%s' "$updated" > "$tmpfile"
  mv "$tmpfile" "$target"

  # 5. Release lock
  exec 9>&-
}
```

This gives you both atomicity (no partial writes) and mutual exclusion (no concurrent
modifications).

> **AGENTIC GROUNDING:** When multiple agents or agent subprocesses operate on the same
> repository, concurrent writes to shared state files (backlog.yaml, events.yaml) can
> corrupt data. The backlog CLI in this project should use file locking to prevent two
> simultaneous `backlog add` commands from interleaving writes. Git itself uses lock files
> (`.git/index.lock`) for the same reason - if two `git add` commands run simultaneously
> without coordination, the index can be corrupted.

---

## Challenge: Inode Detective

**Goal:** Build intuition for the inode model through direct observation.

**Part A - Hard links:**

1. Create a file `original.txt` with some content.
2. Create a hard link `hardlink.txt` pointing to the same file.
3. Use `ls -i` to verify both names have the same inode number.
4. Use `stat` to verify the link count is 2.
5. Modify the file through `hardlink.txt`. Read it through `original.txt`. Confirm the
   change is visible.
6. Delete `original.txt`. Verify `hardlink.txt` still works and the link count is now 1.

**Part B - Symlinks:**

1. Create a symlink `symlink.txt` pointing to `hardlink.txt`.
2. Use `ls -i` to verify the symlink has a different inode.
3. Use `readlink` to see what the symlink points to.
4. Delete `hardlink.txt`. Verify the symlink is now dangling (attempt to `cat` it).
5. Recreate `hardlink.txt`. Verify the symlink works again without modification.

**Part C - Circular symlinks:**

1. Create two symlinks that point to each other: `ln -s b a && ln -s a b`.
2. Attempt to `cat a`. Observe the error message.
3. Use `readlink` (without `-f`) to see the immediate target of each symlink.
4. Use `namei -l a` to visualize the resolution chain.

**Verification:** You should be able to explain why hard links survive deletion but symlinks
do not, in terms of the inode model.

---

## Challenge: Permission Puzzle

**Goal:** Develop intuition for the directory permission model by constructing edge cases.

Create a directory structure that demonstrates all of these cases:

1. **Readable but not listable:** A file inside a directory that has `x` but not `r`. You
   can `cat dir/file.txt` (because `x` allows name resolution) but `ls dir/` fails
   (because `r` is needed to list).

2. **Listable but not accessible:** A directory with `r` but not `x`. You can see
   filenames with `ls dir/` but cannot `cat dir/file.txt` (because `x` is needed to
   resolve the name to an inode).

3. **Executable but not readable:** A script where `x` is set but `r` is not. Can the
   kernel execute it? (Answer depends on whether it is a compiled binary or a script -
   scripts need `r` because the interpreter must read them.)

4. **Write without read:** A file with `w` but not `r`. You can append to it but not read
   it. Try `echo "data" >> file.txt` then `cat file.txt`.

Verify each case. Document the permission bits you set and the exact commands that succeed
or fail.

---

## Challenge: The /proc Explorer

**Goal:** Build a process inspector using only /proc - no external tools like `ps`, `top`,
or `lsof`.

Write a shell script `proc-inspect.sh` that takes a PID as an argument and reports:

1. The command that started the process (`/proc/<pid>/cmdline`)
2. Its current working directory (`/proc/<pid>/cwd`)
3. Its open file descriptors and what they point to (`/proc/<pid>/fd/`)
4. Its memory usage in human-readable form (`/proc/<pid>/status`, look for VmRSS)
5. Selected environment variables (`/proc/<pid>/environ`)
6. Its state (running, sleeping, zombie) (`/proc/<pid>/status`, look for State)

Requirements:
- Handle the case where the PID does not exist (check for `/proc/<pid>/` first)
- Handle permission errors gracefully (you may not be able to read another user's process)
- Use only shell builtins and basic coreutils (no `ps`, `top`, `lsof`, `pgrep`)
- Parse the null-delimited files correctly (`cmdline` and `environ` use `\0` as separator)

```bash
#!/bin/bash
# Usage: ./proc-inspect.sh <pid>

pid=${1:?Usage: $0 <pid>}
proc="/proc/$pid"

if [ ! -d "$proc" ]; then
  printf "Process %s does not exist\n" "$pid" >&2
  exit 1
fi

printf "=== Process %s ===\n\n" "$pid"

# Command line (null-separated, convert to spaces)
printf "Command:  "
tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || printf "(unreadable)"
printf "\n"

# Working directory
printf "CWD:      %s\n" "$(readlink "$proc/cwd" 2>/dev/null || printf '(unreadable)')"

# Executable
printf "Exe:      %s\n" "$(readlink "$proc/exe" 2>/dev/null || printf '(unreadable)')"

# State
printf "State:    %s\n" "$(grep '^State:' "$proc/status" 2>/dev/null | cut -f2-)"

# Memory (VmRSS = resident set size)
printf "Memory:   %s\n" "$(grep '^VmRSS:' "$proc/status" 2>/dev/null | cut -f2- | xargs)"

# Open file descriptors
printf "\nOpen file descriptors:\n"
if [ -r "$proc/fd" ]; then
  for fd in "$proc/fd"/*; do
    [ -e "$fd" ] || continue
    fdnum=$(basename "$fd")
    target=$(readlink "$fd" 2>/dev/null || printf "(unreadable)")
    printf "  fd %s -> %s\n" "$fdnum" "$target"
  done
else
  printf "  (permission denied)\n"
fi

# Environment (first 5 variables)
printf "\nEnvironment (sample):\n"
if [ -r "$proc/environ" ]; then
  tr '\0' '\n' < "$proc/environ" | head -5 | while IFS= read -r line; do
    printf "  %s\n" "$line"
  done
  printf "  ...\n"
else
  printf "  (permission denied)\n"
fi
```

Test it against your own shell: `./proc-inspect.sh $$`

---

## Challenge: Atomic Write Implementation

**Goal:** Implement and test the atomic write pattern in both bash and Python.

**Part A - Bash implementation:**

Write `atomic-write.sh` implementing the `atomic_write` function from section 7. Test it
by:

1. Writing a large file (1MB of random data) atomically.
2. In a loop, continuously reading the target file in one terminal while writing in another.
   Verify the reader never sees partial content.
3. Simulate a crash: start a direct write (`cat /dev/urandom > target.bin`), kill it with
   `kill -9`, and inspect the result. Then do the same with the atomic write function.

**Part B - Python implementation:**

Write `atomic_write.py` implementing the Python version from section 7. Add a test that:

1. Spawns 10 concurrent writers, each writing a different complete JSON document.
2. A reader continuously reads and parses the file.
3. The reader should never encounter invalid JSON.
4. Compare with a naive (non-atomic) write implementation - the naive version should
   fail with parse errors.

---

## Challenge: Filesystem as a Database

**Goal:** Experience the filesystem's strengths and limitations as a state store.

Implement a key-value store using only the filesystem:

```bash
# Interface
kv_set key value      # Write value to file named key
kv_get key            # Read and print the file named key
kv_delete key         # Remove the file named key
kv_list               # List all keys
kv_lock_set key value # Same as kv_set but with flock for concurrency
```

Requirements:
- Store directory is configurable (default: `/tmp/kvstore`)
- Keys are filenames, values are file contents
- Use `flock` for the `kv_lock_set` variant
- Handle keys with special characters (hint: base64-encode the key as the filename, or
  restrict allowed characters and validate)

Then benchmark it:

```bash
# Insert 1000 keys
time for i in $(seq 1 1000); do kv_set "key-$i" "value-$i"; done

# Read 1000 keys
time for i in $(seq 1 1000); do kv_get "key-$i" > /dev/null; done

# Compare with sqlite3
time sqlite3 /tmp/test.db "
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
  $(for i in $(seq 1 1000); do
    printf "INSERT OR REPLACE INTO kv VALUES ('key-%d', 'value-%d');\n" "$i" "$i"
  done)
"
```

For small numbers of keys, the filesystem store is competitive or faster. At scale, the
overhead of one syscall per key (open, write, close) versus one transaction for many rows
becomes apparent. This is why real applications use databases - but the filesystem-as-store
pattern remains valid for simple state tracking (like `.done/` markers).

---

## Challenge: Mount Namespace Exploration

**Goal:** Preview container isolation (Step 9) by creating an isolated mount namespace.

This challenge requires root or `unshare` capabilities.

```bash
# Create a new mount namespace (isolated from the host)
sudo unshare --mount /bin/bash

# Inside the new namespace, create a tmpfs mount
mount -t tmpfs tmpfs /mnt

# Create a file in the mount
echo "namespace secret" > /mnt/secret.txt
cat /mnt/secret.txt
# namespace secret

# From ANOTHER terminal (outside the namespace):
cat /mnt/secret.txt
# cat: /mnt/secret.txt: No such file or directory

# The mount exists only inside the namespace
```

Verify:
1. The mount is visible inside the namespace (`findmnt /mnt` succeeds).
2. The mount is invisible outside the namespace (`findmnt /mnt` fails).
3. Exit the namespace shell. The mount disappears (the tmpfs and all its contents are gone).

This is the mount isolation that containers use. A Docker container sees its own filesystem
tree - overlayfs layers, bind-mounted volumes, its own `/proc` - because it runs in its own
mount namespace. Step 9 covers this in full.

---

## Summary

The filesystem is not just where data lives. It is the state layer of the entire system.

| Concept | Why it matters |
|---------|---------------|
| Everything is a file | Enables the composition model - one interface for all I/O |
| Inodes and directories | A filename is a pointer, not a file. Hard links, deletion semantics, rename atomicity all follow from this. |
| Path resolution | Explains permission errors, dangling symlinks, circular references |
| Permissions | Controls every read, write, and execute the agent performs |
| /proc | Kernel introspection through the file interface |
| /sys | Device and hardware introspection |
| Atomic writes | The only safe way to update state files |
| Mount points and overlayfs | Container filesystems, volume semantics, tmpfs |
| File locking | Mutual exclusion for concurrent writers |

The core principle: **if state is a file, state is inspectable**. `ls`, `stat`, `cat`,
`diff`, `find` - the standard toolkit works on all of it. The Operator's ability to verify
agent output depends on this inspectability.

---

## What to Read Next

- **[Step 4: Text Processing Pipeline](/bootcamp/04-text-pipeline/)** - now that you know where data lives (files), learn
  how to transform it (`grep`, `sed`, `awk`, `jq`). The text pipeline operates on file
  contents; the filesystem provides the substrate.

- **Step 7: Git Internals** - git is a content-addressable filesystem built on top of the
  regular filesystem. Blobs, trees, and commits are files in `.git/objects/`. The index is a
  file (`.git/index`). Refs are files (`.git/refs/`). Everything from this step - inodes,
  paths, atomic writes, symlinks - reappears in git's internal architecture. Step 7 is a
  direct continuation of this material.

---

## References

- Bach, M.J. *The Design of the UNIX Operating System* (1986) - chapter 4 (inodes and the
  buffer cache) remains the clearest explanation of the inode model.
- Kerrisk, M. *The Linux Programming Interface* (2010) - chapters 14-18 cover filesystems,
  directories, links, /proc, and extended attributes with complete system call details.
- `man 7 path_resolution` - the kernel's own documentation of the path resolution algorithm.
- `man 5 proc` - comprehensive documentation of the /proc filesystem.
- `man 5 sysfs` - documentation of the /sys filesystem.
- `man 2 rename` - POSIX guarantee of atomic rename within a filesystem.
- Pike, R. et al. "The Use of Name Spaces in Plan 9" (1992) - the logical conclusion of
  "everything is a file."
