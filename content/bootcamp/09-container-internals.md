+++
title = "Container Internals - Namespaces, Cgroups, and OverlayFS"
date = "2026-03-10"
description = "A container is a process with three kernel restrictions. Namespaces restrict visibility, cgroups restrict resources, and OverlayFS controls the filesystem."
tags = ["containers", "docker", "namespaces", "cgroups", "overlayfs", "linux", "bootcamp"]
step = 9
tier = 1
estimate = "4 hours"
bootcamp = 1
+++

Step 9 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model), Step 3 (filesystem as state, mount points), Step 8 (process observation)
**Leads to:** Step 10 (networking CLI), Step 11 (process supervision)

---

## Why This Step Exists

A container is not a virtual machine. A container is not a lightweight VM. A container is
not "like a VM but faster." These descriptions are not slightly wrong. They are structurally
wrong, and believing them leads to wrong conclusions about security, isolation, and failure
modes.

A container is a **process**. A regular Linux process, running on the same kernel as every
other process on the host, but with three restrictions applied by the kernel:

1. **Namespaces** restrict what the process can *see*
2. **Cgroups** restrict what the process can *use*
3. **Union filesystems** control what is *on disk*

That is the entire explanation. Everything Docker, Podman, containerd, or any other
container runtime does is orchestration of these three kernel features. When you run
`docker run`, the runtime creates namespaces, configures cgroups, mounts an overlayfs,
and then calls `exec` on your entrypoint. The rest is plumbing.

This step matters for the agentic model because the midget container IS the agent's
sandbox. The project's Dockerfile builds a container with Xvfb, fluxbox, xdotool, scrot,
and Python - a virtual display environment where the agent "sees" a screen and sends
input events. Every security guarantee and resource limit of that sandbox reduces to
the three kernel features covered here. When the container OOMs, when a file write
disappears, when the agent cannot reach a host service - understanding the primitives
lets you diagnose the cause instead of guessing.

> **AGENTIC GROUNDING:** When you `docker exec -it container bash`, you are not "logging
> into" anything. You are calling `nsenter` to join the container process's namespaces.
> You then see what it sees, constrained by the same namespace boundaries. Understanding
> this transforms container debugging from cargo-culting Docker commands to reasoning
> from first principles.

---

## Table of Contents

1. [A Container Is a Process](#1-a-container-is-a-process) (~20 min)
2. [Namespaces - Restricting Visibility](#2-namespaces---restricting-visibility) (~60 min)
3. [Cgroups - Restricting Resources](#3-cgroups---restricting-resources) (~45 min)
4. [Union Filesystems (OverlayFS)](#4-union-filesystems-overlayfs) (~40 min)
5. [How Docker Puts It Together](#5-how-docker-puts-it-together) (~30 min)
6. [Security Boundaries and Their Limits](#6-security-boundaries-and-their-limits) (~25 min)
7. [The Midget Container Specifically](#7-the-midget-container-specifically) (~20 min)
8. [Challenges](#challenges) (~60-90 min)
9. [What to Read Next](#what-to-read-next)

---

## 1. A Container Is a Process

*Estimated time: 20 minutes*

Start with a concrete experiment. Run a container and observe it from the host:

```bash
# Run a container that sleeps
docker run -d --name test-container ubuntu:24.04 sleep 3600

# From the HOST, find the container's process
ps aux | grep "sleep 3600"

# You will see something like:
# root  12345  0.0  0.0  2576  1024 ?  Ss  10:30  0:00  sleep 3600
```

That is not a VM. That is `sleep 3600` running as a process on your host. It has a PID
in the host's PID table. It consumes entries in the host's process scheduler. The kernel
manages it exactly like any other process.

Now look at it from inside:

```bash
# Enter the container
docker exec -it test-container bash

# What PID does the container think it has?
ps aux
# PID 1: sleep 3600
# The container sees ONLY its own processes. "sleep" is PID 1 inside.

exit
```

The same process is PID 12345 on the host and PID 1 inside the container. This is not
magic. It is a PID namespace - the kernel maintains two views of the same process tree.

### The anatomy of a running container

```
+------------------------------------------------------------------+
|  HOST KERNEL (shared - one kernel for everything)                |
|                                                                  |
|  Host processes: systemd(1), sshd, dockerd, ...                  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | CONTAINER PROCESS (just a process with restrictions)        |  |
|  |                                                             |  |
|  |  Three restrictions applied:                                |  |
|  |                                                             |  |
|  |  1. NAMESPACES (what it can see)                            |  |
|  |     - PID ns:    sees its own PID tree (PID 1 = itself)     |  |
|  |     - Mount ns:  sees its own filesystem tree               |  |
|  |     - Net ns:    sees its own network stack                 |  |
|  |     - UTS ns:    sees its own hostname                      |  |
|  |     - IPC ns:    sees its own shared memory/semaphores      |  |
|  |     - User ns:   UID 0 inside may be UID 1000 outside      |  |
|  |     - Cgroup ns: sees its own cgroup tree                   |  |
|  |                                                             |  |
|  |  2. CGROUPS (what it can use)                               |  |
|  |     - Memory:  max 512MB (OOM killed if exceeded)           |  |
|  |     - CPU:     1.5 cores max                                |  |
|  |     - PIDs:    max 100 processes                            |  |
|  |     - I/O:     bandwidth limits                             |  |
|  |                                                             |  |
|  |  3. OVERLAYFS (what is on disk)                             |  |
|  |     - Lower layers: read-only image layers                  |  |
|  |     - Upper layer:  writable, ephemeral                     |  |
|  |     - Merged view:  what the process sees as "/"            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

Compare this to a virtual machine:

```
+------------------------------------------------------------------+
|  HOST KERNEL                                                     |
|                                                                  |
|  Hypervisor (KVM/QEMU/VMware)                                   |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | VIRTUAL MACHINE                                             |  |
|  |                                                             |  |
|  |  GUEST KERNEL (separate, complete kernel)                   |  |
|  |  Virtual CPU, virtual memory, virtual disk, virtual NIC     |  |
|  |  Full hardware abstraction                                  |  |
|  |  The guest OS does not know it is virtualized               |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

The structural difference: a VM has its own kernel. A container shares the host kernel.
This means:

- A container starts in milliseconds (no kernel boot). A VM takes seconds to minutes.
- A container uses the host's memory management (no double paging). A VM has its own page tables inside the guest, mapped through the hypervisor to real memory.
- A container's syscalls go directly to the host kernel. A VM's syscalls go to the guest kernel, which may trap to the hypervisor.
- A kernel exploit inside a container can compromise the host. A kernel exploit inside a VM compromises only the guest.

That last point is the critical security distinction. Namespaces restrict the process's
view. They do not create a security boundary at the hardware level. A kernel vulnerability
that allows privilege escalation will escape any namespace.

> **HISTORY:** The idea of isolating processes with restricted views of the system predates
> both containers and VMs. `chroot` (1979) - change root - was the first mechanism. It
> changes the apparent root directory for a process, so it cannot see files outside its new
> root. Bill Joy added it to BSD to provide isolated build environments. It was never
> designed as a security boundary, and it is trivially escapable (a process with root
> privileges can `chroot` again to break out). But the conceptual seed - "give a process a
> different view of the filesystem" - grew into mount namespaces two decades later.

```bash
# Clean up
docker rm -f test-container
```

---

## 2. Namespaces - Restricting Visibility

*Estimated time: 60 minutes*

A namespace wraps a global system resource in an abstraction that makes it appear to
processes within the namespace that they have their own isolated instance of that
resource. The key word is "appear." The resource is not duplicated. The kernel maintains
the real resource and provides filtered views.

Linux has seven types of namespaces:

| Namespace | Flag | Isolates | Kernel version |
|-----------|------|----------|----------------|
| Mount | `CLONE_NEWNS` | Mount points, filesystem tree | 2.4.19 (2002) |
| UTS | `CLONE_NEWUTS` | Hostname, domain name | 2.6.19 (2006) |
| IPC | `CLONE_NEWIPC` | Shared memory, semaphores, message queues | 2.6.19 (2006) |
| PID | `CLONE_NEWPID` | Process IDs | 2.6.24 (2008) |
| Network | `CLONE_NEWNET` | Network stack (interfaces, routes, iptables) | 2.6.29 (2009) |
| User | `CLONE_NEWUSER` | UIDs, GIDs, capabilities | 3.8 (2012) |
| Cgroup | `CLONE_NEWCGROUP` | Cgroup root directory | 4.6 (2016) |

> **HISTORY:** Linux namespaces were not designed as a unified "container" feature. They
> were added incrementally over a decade by different kernel developers solving different
> problems. Mount namespaces came first (2002) - Al Viro's work to allow per-process
> filesystem views. PID namespaces came six years later. User namespaces took until 2012.
> "Containers" emerged from composing features that were never designed to be composed.
> This is why the container security model has gaps - it was not engineered as a coherent
> security boundary. It was assembled from independent isolation primitives.

### PID Namespace

The most intuitive namespace. A process in a new PID namespace sees its own PID tree.
The first process in the namespace is PID 1 - the init process of that namespace.

```bash
# Create a new PID namespace with unshare
# --pid: new PID namespace
# --fork: fork before exec (required for PID namespaces)
# --mount-proc: mount a new /proc so ps works correctly
sudo unshare --pid --fork --mount-proc bash

# Inside the new namespace:
ps aux
# You see only processes in THIS namespace
# bash is PID 1

printf 'My PID: %s\n' "$$"
# Output: 1

# Exit back to host
exit
```

Why `--fork` is required: the `unshare` process itself was created in the parent PID
namespace. A PID namespace only applies to processes *created after* the namespace is
established. So `unshare` must fork, and the child (in the new namespace) becomes PID 1.
Without `--fork`, the namespace is created but the current process is not in it, and the
next exec fails because there is no PID 1 in the namespace.

Why `--mount-proc` is required: `ps` reads from `/proc`. If you do not mount a new
`/proc` inside the PID namespace, `ps` reads the host's `/proc` and shows the host's
processes. The PID namespace isolates the PID numbers, but `/proc` is a mount - it must
be remounted to reflect the new namespace.

From the host, you can still see the process:

```bash
# In terminal 1: create namespaced process
sudo unshare --pid --fork --mount-proc sleep 3600 &
UNSHARE_PID=$!

# In terminal 2: find it on the host
ps aux | grep "sleep 3600"
# The sleep process has a normal host PID (e.g., 54321)
# But inside its PID namespace, it is PID 1

# Check its PID namespace
ls -la /proc/$(pgrep -f "sleep 3600")/ns/pid
# Shows the namespace inode - different from the host's

# Compare with your shell's PID namespace
ls -la /proc/self/ns/pid
# Different inode = different namespace

# Clean up
kill $UNSHARE_PID
```

### Mount Namespace

Each process can have its own view of the filesystem's mount tree. Mounts made inside
a mount namespace are invisible outside it.

```bash
# Create a new mount namespace
sudo unshare --mount bash

# Inside: mount a tmpfs at /mnt
mount -t tmpfs none /mnt
printf 'secret data\n' > /mnt/secret.txt
cat /mnt/secret.txt
# Output: secret data

# In another terminal (host namespace): check /mnt
ls /mnt/
# Empty - the mount is invisible from the host

# Exit the namespace
exit
# The mount is gone. It existed only in the namespace.
```

This is how containers have their own `/` without affecting the host. The container
runtime creates a mount namespace and mounts the overlayfs as the container's root
filesystem. The host's root filesystem is untouched.

### Network Namespace

A process in a new network namespace has its own network stack: its own interfaces, its
own routing table, its own iptables rules. Initially, the namespace has only a loopback
interface (and it is down).

```bash
# Create a network namespace
sudo unshare --net bash

# Inside: what interfaces exist?
ip link
# Only lo (loopback), and it is DOWN

ip addr
# lo has no address

# Try to reach the internet
ping -c 1 8.8.8.8 2>&1
# Network is unreachable - there are no routes, no interfaces connected to the outside

exit
```

To connect a network namespace to the host, you create a **veth pair** - a virtual
ethernet cable with one end in each namespace. Docker does this automatically. Each
container gets one end of a veth pair, and the other end is attached to the `docker0`
bridge on the host.

```bash
# This is what Docker does under the hood:

# Create a network namespace (the "ip" tool can manage named namespaces)
sudo ip netns add testns

# Create a veth pair
sudo ip link add veth-host type veth peer name veth-container

# Move one end into the namespace
sudo ip link set veth-container netns testns

# Configure the host end
sudo ip addr add 10.0.0.1/24 dev veth-host
sudo ip link set veth-host up

# Configure the container end (inside the namespace)
sudo ip netns exec testns ip addr add 10.0.0.2/24 dev veth-container
sudo ip netns exec testns ip link set veth-container up
sudo ip netns exec testns ip link set lo up

# Test: ping from host to namespace
ping -c 1 10.0.0.2
# Success

# Test: ping from namespace to host
sudo ip netns exec testns ping -c 1 10.0.0.1
# Success

# Clean up
sudo ip netns delete testns
sudo ip link delete veth-host
```

> **AGENTIC GROUNDING:** Network namespace isolation is the primary mechanism preventing
> an agent container from reaching host services it should not access. If the agent
> container runs with `--network host`, ALL namespace isolation is bypassed - the container
> shares the host's network stack and can reach every service on localhost. This is a
> common misconfiguration. When reviewing Docker Compose files or `docker run` commands
> generated by agents, check the network mode.

### UTS Namespace

UTS (Unix Time-Sharing) namespace isolates the hostname and NIS domain name. Simple
but important - it lets each container have its own hostname.

```bash
# Create a new UTS namespace
sudo unshare --uts bash

# Change the hostname
hostname container-test
hostname
# Output: container-test

# In another terminal:
hostname
# Output: your-original-hostname (unaffected)

exit
```

### IPC Namespace

Isolates System V IPC objects (shared memory segments, semaphore sets, message queues)
and POSIX message queues. Processes in different IPC namespaces cannot see each other's
shared memory.

```bash
# List current IPC objects
ipcs

# Create new IPC namespace
sudo unshare --ipc bash

# Inside: create a shared memory segment
ipcmk -M 1024
# Created shared memory segment

ipcs -m
# Shows the segment

# In another terminal (host):
ipcs -m
# Does NOT show the segment

exit
```

### User Namespace

The most complex namespace. It maps UIDs and GIDs inside the namespace to different UIDs
and GIDs outside. The critical implication: a process can be UID 0 (root) inside the
namespace while being UID 1000 (unprivileged) outside.

```bash
# Create a user namespace (does not require root!)
unshare --user --map-root-user bash

# Inside: who am I?
id
# uid=0(root) gid=0(root)

# But from the host, this process runs as your regular user
# In another terminal:
ps -o pid,uid,user,comm -p $(pgrep -f "unshare.*user")
# Shows your regular UID

exit
```

User namespaces are what make rootless containers possible (Podman's default mode).
The container process runs as root inside (can install packages, bind to port 80) but
is an unprivileged user on the host. A breakout from the container lands you as an
unprivileged user, not root.

### Viewing Namespace Memberships

Every process's namespace memberships are visible in `/proc/PID/ns/`:

```bash
# List your shell's namespaces
ls -la /proc/self/ns/
# Each entry is a symlink to a namespace identified by type:[inode]
# e.g., pid:[4026531836]

# Two processes in the same namespace have the same inode number
# Two processes in different namespaces have different inode numbers

# Compare your shell with PID 1 (init/systemd):
ls -la /proc/1/ns/
ls -la /proc/self/ns/
# They should match (unless you are in a container yourself)
```

### nsenter - Entering Existing Namespaces

`nsenter` joins an existing process's namespaces. This is how `docker exec` works.

```bash
# Find a container's PID on the host
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' some-container)

# Enter its namespaces
sudo nsenter -t $CONTAINER_PID --pid --mount --net --uts --ipc bash
# You now see what the container sees
```

The `--target` (`-t`) flag specifies which process's namespaces to join. Each `--pid`,
`--mount`, etc. flag specifies which namespaces to enter. You can enter some namespaces
but not others - for example, enter the network namespace but keep the host's mount
namespace, which is useful for debugging.

> **HISTORY:** Plan 9 from Bell Labs (1992) - the research successor to Unix - had
> per-process namespaces as a first-class concept. Every process could have a completely
> different view of the filesystem namespace. You could mount a network connection as a
> file, mount a remote machine's files as a local directory, or give a process a
> completely custom `/dev`. Linux namespaces are a partial implementation of Plan 9's
> vision. Eric Van Riel, Al Viro, and others brought the idea back to Linux starting in
> 2002 with mount namespaces.

---

## 3. Cgroups - Restricting Resources

*Estimated time: 45 minutes*

Namespaces control what a process can see. Cgroups (control groups) control what a process
can use. Without cgroups, a container process could consume all the host's memory, all
the CPU, and spawn unlimited processes. Cgroups impose limits.

### Cgroups v2

Modern Linux uses cgroups v2 (unified hierarchy). The older cgroups v1 had separate
hierarchies per resource controller (one for memory, one for CPU, etc.). Cgroups v2
merges them into a single hierarchy mounted at `/sys/fs/cgroup/`.

Check which version your system uses:

```bash
# If this directory exists and contains controller files, you are on v2
ls /sys/fs/cgroup/cgroup.controllers
# Output: cpuset cpu io memory hugetlb pids rdma misc

# If you see /sys/fs/cgroup/memory/, /sys/fs/cgroup/cpu/, etc. as
# separate directories, you are on v1 (or hybrid mode)

# Check the mount
mount | grep cgroup
# On v2: cgroup2 on /sys/fs/cgroup type cgroup2 (...)
```

### The cgroup hierarchy

Cgroups form a tree. The root cgroup is `/sys/fs/cgroup/`. Child cgroups are
subdirectories. Every process belongs to exactly one cgroup. Limits on a parent cgroup
constrain all children.

```
/sys/fs/cgroup/                   (root cgroup)
  +-- system.slice/               (systemd services)
  |     +-- docker.service/       (dockerd itself)
  +-- user.slice/                 (user sessions)
  |     +-- user-1000.slice/      (your user)
  +-- docker/                     (container cgroups)
        +-- abc123.../            (container abc123's cgroup)
```

### Creating a cgroup manually

You do not need Docker to use cgroups. Create one with `mkdir`:

```bash
# Create a cgroup (requires root or delegation)
sudo mkdir /sys/fs/cgroup/bootcamp-test

# See what controllers are available
cat /sys/fs/cgroup/bootcamp-test/cgroup.controllers
# Output: cpuset cpu io memory hugetlb pids rdma misc

# Enable memory and pids controllers for children
printf '+memory +pids' | sudo tee /sys/fs/cgroup/bootcamp-test/cgroup.subtree_control
```

### Memory limits

```bash
# Set a memory limit of 50MB
printf '52428800' | sudo tee /sys/fs/cgroup/bootcamp-test/memory.max

# Check the limit
cat /sys/fs/cgroup/bootcamp-test/memory.max
# Output: 52428800

# See current memory usage
cat /sys/fs/cgroup/bootcamp-test/memory.current
# Output: 0 (nothing in this cgroup yet)

# Add the current shell to this cgroup
printf "$$" | sudo tee /sys/fs/cgroup/bootcamp-test/cgroup.procs

# Now any memory this shell (and its children) allocate counts against the 50MB limit
# Try to allocate more than 50MB:
python3 -c "x = bytearray(60 * 1024 * 1024)"
# OOM killed! The kernel's OOM killer terminates the process.
```

When the OOM killer fires inside a cgroup, `dmesg` on the host records it:

```bash
dmesg | tail -5
# Memory cgroup out of memory: Killed process 12345 (python3)
#   total-vm:65536kB, anon-rss:51200kB, file-rss:4096kB
```

> **AGENTIC GROUNDING:** When a container process is OOM killed, the process simply dies.
> There is no graceful "out of memory" exception the process can catch. From inside the
> container, the process is gone. From the host, `dmesg` shows the OOM killer log with the
> cgroup that triggered it. If an agent's container keeps dying mysteriously, check `dmesg`
> for OOM kills. The fix is either to increase the memory limit or to fix the memory leak.

### CPU limits

Cgroups offer two models for CPU limiting:

**CPU weight (shares)** - relative allocation. If cgroup A has weight 100 and cgroup B has
weight 200, B gets twice the CPU time when both are competing. If A is idle, B gets all
available CPU. Weights are only enforced under contention.

```bash
# Set CPU weight (1-10000, default 100)
printf '50' | sudo tee /sys/fs/cgroup/bootcamp-test/cpu.weight
# This cgroup gets half the default weight
```

**CPU max (quota/period)** - absolute allocation. "This cgroup can use X microseconds of
CPU time per Y microseconds." This is a hard cap regardless of whether other cgroups are
using their allocation.

```bash
# Allow 1.5 CPUs worth of time (150000 out of every 100000 microseconds)
printf '150000 100000' | sudo tee /sys/fs/cgroup/bootcamp-test/cpu.max

# Allow 0.5 CPUs (50000 out of every 100000 microseconds)
printf '50000 100000' | sudo tee /sys/fs/cgroup/bootcamp-test/cpu.max
```

This is what `docker run --cpus 1.5` translates to: `150000 100000` written to `cpu.max`.

### PID limits

```bash
# Limit to 20 processes maximum
printf '20' | sudo tee /sys/fs/cgroup/bootcamp-test/pids.max

# If a process in this cgroup tries to fork beyond 20 total, fork() returns EAGAIN
```

This is the defense against fork bombs inside containers. Without a PID limit, a
runaway process inside a container can exhaust the host's PID space.

### I/O limits

```bash
# Limit I/O bandwidth on a specific device (e.g., 8:0 = /dev/sda)
# Read: max 10MB/s, Write: max 5MB/s
printf '8:0 rbps=10485760 wbps=5242880' | \
  sudo tee /sys/fs/cgroup/bootcamp-test/io.max
```

### How Docker maps to cgroups

| Docker flag | Cgroup file | Meaning |
|-------------|-------------|---------|
| `--memory 512m` | `memory.max = 536870912` | Hard memory limit |
| `--memory-reservation 256m` | `memory.low = 268435456` | Soft limit (best effort) |
| `--cpus 1.5` | `cpu.max = 150000 100000` | CPU quota |
| `--cpu-shares 512` | `cpu.weight = ~50` | Relative CPU weight |
| `--pids-limit 100` | `pids.max = 100` | Max processes |

```bash
# Run a container with limits
docker run -d --name limited \
  --memory 512m \
  --cpus 1.5 \
  --pids-limit 100 \
  ubuntu:24.04 sleep 3600

# Find the container's cgroup on the host
CONTAINER_ID=$(docker inspect --format '{{.Id}}' limited)
CGROUP_PATH="/sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope"
# (path varies by system - may be under /sys/fs/cgroup/docker/)

# Read the limits
cat "${CGROUP_PATH}/memory.max"
# 536870912 (512 * 1024 * 1024)

cat "${CGROUP_PATH}/cpu.max"
# 150000 100000

cat "${CGROUP_PATH}/pids.max"
# 100

# Read current usage
cat "${CGROUP_PATH}/memory.current"
cat "${CGROUP_PATH}/cpu.stat"
cat "${CGROUP_PATH}/pids.current"

docker rm -f limited
```

> **HISTORY:** Cgroups were contributed to the Linux kernel by Google engineers Paul Menage
> and Rohit Seth in 2008 (kernel 2.6.24). Google was running everything in containers
> internally - their cluster management system Borg (predecessor to Kubernetes) needed
> kernel support for resource isolation. The initial implementation (cgroups v1) had
> separate hierarchies per controller, which created complexity. Tejun Heo rewrote the
> system as cgroups v2 (unified hierarchy), merged in kernel 4.5 (2016). The migration
> from v1 to v2 took years; most distributions completed it around 2022-2023.

### Cleanup

```bash
# Remove the test cgroup (must be empty - no processes)
# First move your shell back to the root cgroup if you added it
printf "$$" | sudo tee /sys/fs/cgroup/cgroup.procs
sudo rmdir /sys/fs/cgroup/bootcamp-test
```

---

## 4. Union Filesystems (OverlayFS)

*Estimated time: 40 minutes*

### The problem

A Docker image is composed of layers. Each `RUN`, `COPY`, or `ADD` instruction in a
Dockerfile creates a new layer. A typical image has 5-20 layers. Each layer is a tarball
of filesystem changes (files added, modified, or deleted relative to the layer below).

When you run a container, the container needs:
1. Access to all the image layers (read-only - the image is shared by all containers using it)
2. A writable layer for the container's own file modifications
3. A merged view that looks like a normal filesystem

OverlayFS solves all three requirements.

### OverlayFS - the union mount

OverlayFS presents a unified view of two directory trees:

- **lowerdir**: read-only layers (one or more, colon-separated)
- **upperdir**: read-write layer where modifications are stored
- **workdir**: scratch space used by the kernel for atomic operations (must be on the same filesystem as upperdir)
- **merged**: the unified view that processes see

```
        Merged view (what the process sees as "/")
        +------------------------------------------+
        |  /bin/bash  /etc/passwd  /tmp/myfile.txt  |
        +------------------------------------------+
             |              |              |
        OverlayFS combines them:
             |              |              |
  +----------+----+  +-----+------+  +----+---------+
  | Lower layer   |  | Lower layer|  | Upper layer  |
  | (read-only)   |  | (read-only)|  | (read-write) |
  | /bin/bash      |  | /etc/passwd|  | /tmp/myfile  |
  +---------------+  +------------+  +--------------+
```

### Building it by hand

```bash
# Create the directory structure
mkdir -p /tmp/overlay-lab/{lower,upper,work,merged}

# Populate the lower layer (simulating an image layer)
printf 'original content\n' > /tmp/overlay-lab/lower/file1.txt
printf 'this will be deleted\n' > /tmp/overlay-lab/lower/file2.txt
mkdir -p /tmp/overlay-lab/lower/etc
printf 'lower-hostname\n' > /tmp/overlay-lab/lower/etc/hostname

# Mount the overlay
sudo mount -t overlay overlay \
  -o lowerdir=/tmp/overlay-lab/lower,upperdir=/tmp/overlay-lab/upper,workdir=/tmp/overlay-lab/work \
  /tmp/overlay-lab/merged

# Verify: the merged view shows the lower layer's files
ls /tmp/overlay-lab/merged/
# file1.txt  file2.txt  etc

cat /tmp/overlay-lab/merged/file1.txt
# original content
```

### Copy-on-write

Reading a file from the lower layer costs nothing extra - OverlayFS serves it directly
from the lower directory. But when you write to a file that exists in the lower layer,
OverlayFS copies it to the upper layer first, then modifies the copy. The lower layer
is never touched.

```bash
# Modify a file from the lower layer
printf 'modified content\n' > /tmp/overlay-lab/merged/file1.txt

# Check the lower layer - unchanged
cat /tmp/overlay-lab/lower/file1.txt
# original content

# Check the upper layer - the modified copy lives here
cat /tmp/overlay-lab/upper/file1.txt
# modified content

# The merged view shows the upper layer's version
cat /tmp/overlay-lab/merged/file1.txt
# modified content
```

The upper layer "wins." When a file exists in both lower and upper, the merged view
shows the upper layer's version.

### Creating new files

New files go directly into the upper layer:

```bash
# Create a new file in the merged view
printf 'new file\n' > /tmp/overlay-lab/merged/newfile.txt

# It exists only in the upper layer
ls /tmp/overlay-lab/upper/
# file1.txt  newfile.txt

ls /tmp/overlay-lab/lower/
# file1.txt  file2.txt  etc
# No newfile.txt
```

### Whiteout files - deletion in a union filesystem

How do you "delete" a file that exists in a read-only lower layer? You cannot remove it
from the lower directory. OverlayFS uses **whiteout files** - special character device
files (0,0) in the upper layer that tell the kernel "pretend this file does not exist in
the merged view."

```bash
# Delete file2.txt (which exists in the lower layer)
rm /tmp/overlay-lab/merged/file2.txt

# The merged view no longer shows it
ls /tmp/overlay-lab/merged/
# file1.txt  etc  newfile.txt
# file2.txt is gone

# But the lower layer is untouched
ls /tmp/overlay-lab/lower/
# file1.txt  file2.txt  etc
# file2.txt still exists

# The upper layer has a whiteout file
ls -la /tmp/overlay-lab/upper/
# You will see file2.txt as a character device (c 0,0)
# This is the whiteout marker
stat /tmp/overlay-lab/upper/file2.txt
# File type: character special file
# Device: 0,0
```

For directory deletion, OverlayFS uses an **opaque directory** - a directory in the upper
layer with a trusted xattr (`trusted.overlay.opaque=y`) that hides the entire lower
directory.

### How Docker uses OverlayFS

Each Docker image layer is a directory. When you run a container, Docker (or the storage
driver) mounts an overlay with:

- **lowerdir**: all image layers, from bottom to top, colon-separated
- **upperdir**: a new empty directory for this specific container
- **merged**: the container's root filesystem

```bash
# See Docker's overlay mounts
mount | grep overlay
# overlay on /var/lib/docker/overlay2/.../merged type overlay
#   (lowerdir=...:...:...,upperdir=...,workdir=...)

# The lowerdir contains multiple paths separated by colons
# Each path is one image layer
# The rightmost path is the bottom layer (FROM ubuntu:24.04 base)
# The leftmost path is the top layer (last Dockerfile instruction)
```

When the container is stopped and removed, Docker deletes the upper layer directory. All
writes the container made are gone. The image layers (lower) are untouched and shared by
every container running from that image.

> **AGENTIC GROUNDING:** This is why container writes are ephemeral. If an agent writes a
> file inside the container, it goes to the overlayfs upper layer. When the container is
> destroyed, that layer is deleted. If the agent must persist data - logs, output files,
> model weights - it must write to a Docker volume (a bind mount from the host) or a
> mounted external storage. Understanding overlayfs makes this not a Docker quirk to
> memorize but a direct consequence of how union filesystems work.

### Cleanup

```bash
sudo umount /tmp/overlay-lab/merged
rm -rf /tmp/overlay-lab
```

> **HISTORY:** OverlayFS was merged into the Linux kernel in version 3.18 (2014) by Miklos
> Szeredi. Before OverlayFS, Docker used AUFS (Another Union File System), which was never
> merged into mainline Linux and required patched kernels. The Debian and Ubuntu kernels
> included AUFS patches, which is partly why Docker was initially popular on Ubuntu. The
> move to OverlayFS (overlay2 storage driver) gave Docker a union filesystem that worked on
> any standard Linux kernel. Other union filesystem approaches include eCryptFS and
> UnionFS, but OverlayFS won the adoption race for containers.

---

## 5. How Docker Puts It Together

*Estimated time: 30 minutes*

`docker run` is syntactic sugar for a sequence of kernel operations. Understanding the
sequence makes every Docker behavior predictable.

### The sequence

```
docker run --memory 512m --cpus 1.5 -v /host/data:/data ubuntu:24.04 /bin/bash

1. Pull image layers (if not cached)
   - Download and unpack each layer to /var/lib/docker/overlay2/

2. Create namespaces
   - clone(CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWNET | CLONE_NEWUTS | CLONE_NEWIPC)
   - The new process is in all seven namespaces

3. Set up cgroups
   - mkdir /sys/fs/cgroup/docker/<container-id>/
   - Write memory.max = 536870912
   - Write cpu.max = 150000 100000
   - Add the process to the cgroup

4. Mount overlayfs
   - mount -t overlay overlay \
       -o lowerdir=layer1:layer2:...,upperdir=<new>,workdir=<new> \
       <merged>

5. Mount volumes
   - mount --bind /host/data <merged>/data
   - This is a bind mount: the host directory appears inside the container

6. pivot_root
   - Change the container process's root filesystem to the merged overlayfs
   - The old root is unmounted (or moved)
   - The process now sees the overlayfs merged directory as "/"

7. exec the entrypoint
   - exec("/bin/bash")
   - This replaces the container runtime's process with the target process
   - It becomes PID 1 in the container's PID namespace
```

### The entrypoint.sh in this project

Look at the project's `entrypoint.sh`:

```bash
#!/bin/bash
# Midget entrypoint - starts virtual display + window manager
set -e

# Start Xvfb (virtual framebuffer)
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} -ac &
XVFB_PID=$!
sleep 1

# Verify Xvfb is running
if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "FATAL: Xvfb failed to start" >&2
    exit 1
fi

# Start fluxbox (minimal window manager - needed for window focus/raise)
fluxbox -display :99 &
sleep 1

echo "Midget display ready - ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} on :99"

# If arguments provided, run them; otherwise interactive shell
if [ $# -gt 0 ]; then
    exec "$@"
else
    exec /bin/bash
fi
```

Several things are happening that connect to the container internals we have covered:

**PID 1 behavior:** The entrypoint script runs as PID 1 inside the container's PID
namespace. PID 1 has special behavior in Linux: the kernel does not deliver SIGTERM or
SIGINT to PID 1 unless the process has explicitly registered a signal handler. This means
if a dumb script is PID 1 and does not trap signals, `docker stop` (which sends SIGTERM)
will have no effect, and Docker will wait its timeout (10 seconds by default) and then
send SIGKILL.

The `exec "$@"` at the end replaces the shell with the target process. If the command is
`python3 steer.py`, then `python3` becomes PID 1. Python does register a SIGTERM handler
by default, so `docker stop` works correctly. Without `exec`, the shell would remain PID 1,
python3 would be PID 2, and SIGTERM from `docker stop` would go to the shell (PID 1),
not to python3.

**Background processes:** Xvfb and fluxbox are started as background processes (`&`). They
are children of the entrypoint shell. When `exec "$@"` replaces the shell with the target
process, Xvfb and fluxbox become orphans - their parent (the shell) is gone. The kernel
reparents orphans to PID 1 (the new process). So the target process becomes the reaper
for Xvfb and fluxbox.

**Environment variables:** `SCREEN_WIDTH`, `SCREEN_HEIGHT`, `SCREEN_DEPTH`, and `DISPLAY`
are set in the Dockerfile with `ENV`. They are inherited by every process in the
container because environment variables are per-process state (Step 1) and children inherit
them via `fork/exec`.

### docker exec = nsenter

When you run `docker exec -it container bash`, Docker:

1. Finds the container's PID on the host
2. Calls `nsenter` (or equivalent) to enter all of the container's namespaces
3. Execs `bash` inside those namespaces

The new bash process shares the container's PID namespace, mount namespace, network
namespace, etc. It sees what the container sees.

```bash
# These are equivalent:
docker exec -it my-container bash

# and (approximately):
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' my-container)
sudo nsenter -t $CONTAINER_PID --pid --mount --net --uts --ipc bash
```

### docker volume = bind mount

A Docker volume is a bind mount from the host filesystem into the container's mount
namespace. It bypasses overlayfs entirely.

```bash
docker run -v /host/path:/container/path ubuntu:24.04 bash
```

This creates a bind mount: `/container/path` inside the container points directly to
`/host/path` on the host. Writes here persist because they go to the host filesystem,
not to the overlayfs upper layer.

### docker network = veth pairs and bridges

When Docker creates a container with the default `bridge` network:

1. Creates a veth pair (virtual ethernet cable)
2. Attaches one end to the `docker0` bridge on the host
3. Moves the other end into the container's network namespace
4. Assigns an IP address from the bridge's subnet
5. Sets up NAT (iptables MASQUERADE) so the container can reach the internet through the host

```bash
# See the docker bridge
ip addr show docker0
# 172.17.0.1/16

# See veth pairs on the host (one per running container)
ip link | grep veth

# Inside a container:
ip addr
# eth0: 172.17.0.2/16 (this is the container's end of the veth pair)

ip route
# default via 172.17.0.1 dev eth0 (traffic goes through the bridge)
```

---

## 6. Security Boundaries and Their Limits

*Estimated time: 25 minutes*

Namespaces provide isolation, not security. This distinction is critical for the agent
sandboxing use case.

### The kernel attack surface

The container process makes syscalls directly to the host kernel. Every syscall is an
entry point. A vulnerability in the kernel's handling of any syscall can potentially allow
container escape. The attack surface is the entire kernel syscall interface.

Compare to a VM: the guest makes syscalls to the guest kernel. The host kernel's attack
surface from the VM is limited to the hypervisor interface (much smaller than the full
syscall table).

### Defense in depth

Docker applies multiple layers of restriction beyond namespaces:

**Linux capabilities:** Root's powers are divided into approximately 40 capabilities.
Docker drops most of them by default. A container process running as root inside has only
a subset of root's powers.

```bash
# See what capabilities a container gets by default
docker run --rm ubuntu:24.04 grep Cap /proc/self/status
# CapPrm/CapEff show the permitted/effective capability sets

# Decode the hex with capsh
docker run --rm ubuntu:24.04 bash -c \
  'apt-get update -qq && apt-get install -y -qq libcap2-bin > /dev/null 2>&1 && \
   capsh --decode=$(grep CapEff /proc/self/status | awk "{print \$2}")'
# Shows the list of capabilities the container has
```

Notable capabilities Docker drops by default:
- `CAP_SYS_ADMIN` - the "do anything" capability (mount filesystems, change namespaces, trace processes, etc.)
- `CAP_NET_RAW` - raw socket access (packet crafting, network sniffing)
- `CAP_SYS_PTRACE` - trace/debug other processes
- `CAP_SYS_MODULE` - load kernel modules

**seccomp profiles:** Docker applies a default seccomp (secure computing) profile that
blocks approximately 40 dangerous syscalls. The profile is a JSON whitelist/blacklist
of allowed syscalls.

```bash
# See if seccomp is active in a container
docker run --rm ubuntu:24.04 grep Seccomp /proc/self/status
# Seccomp: 2  (means seccomp filter is active)
# Seccomp_filters: 1

# Blocked syscalls include:
# - reboot (obvious)
# - mount (prevents mounting filesystems)
# - unshare (prevents creating new namespaces)
# - kexec_load (loading a new kernel)
# - bpf (eBPF programs - kernel extension)
```

**AppArmor / SELinux:** Mandatory access control profiles. Docker generates an AppArmor
profile for each container (on systems with AppArmor) that restricts filesystem access,
network operations, and capability use.

### The threat model for agent sandboxing

For the midget container, the threat model is:

1. **The agent process should not access the host filesystem.**
   - Control: mount namespace (container has its own root), no host volumes with sensitive data
   - Weakness: bind mounts (`-v`) expose host paths. If a volume is mounted, the agent can read/write it.

2. **The agent should not access host network services it should not reach.**
   - Control: network namespace (own network stack), Docker network isolation
   - Weakness: `--network host` bypasses all network isolation. Docker bridge NAT allows outbound connections by default.

3. **The agent should not consume all host resources.**
   - Control: cgroup memory limit, CPU limit, PID limit
   - Weakness: if limits are not set (no `--memory`, `--cpus` flags), the container can consume everything.

4. **The agent should not escalate to host root.**
   - Control: `USER agent` in Dockerfile (non-root inside), dropped capabilities, seccomp
   - Weakness: a kernel exploit could bypass all these controls because they all run on the same kernel.

```bash
# The project's Dockerfile uses USER agent:
# USER agent
# This means the container process runs as the "agent" user (UID 1000 typically)
# Even inside the container, it is not root
# It cannot install packages, bind to privileged ports, or modify system files
```

### What breaks the model

Things that weaken or break container isolation:

| Configuration | Effect |
|---------------|--------|
| `--privileged` | Disables ALL security: full capabilities, no seccomp, device access |
| `--network host` | Shares host network namespace - can reach any host service |
| `--pid host` | Shares host PID namespace - can see all processes |
| `-v /:/host` | Mounts entire host filesystem into container |
| `--cap-add SYS_ADMIN` | Allows mount, unshare, and many other dangerous operations |
| `--security-opt seccomp=unconfined` | Disables seccomp filtering |

> **AGENTIC GROUNDING:** When reviewing Docker configurations generated by agents, or
> when debugging why an agent container "needs" `--privileged`, check this list. Agents
> frequently request `--privileged` because it "fixes" permission errors. It does - by
> removing all security boundaries. The correct fix is almost always to grant the specific
> capability needed (`--cap-add`) or to fix the underlying permission issue.

---

## 7. The Midget Container Specifically

*Estimated time: 20 minutes*

Now connect everything to the project's actual container.

### The Dockerfile

```dockerfile
# Midget POC - minimal Linux agent sandbox
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1280
ENV SCREEN_HEIGHT=720
ENV SCREEN_DEPTH=24

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb fluxbox xdotool scrot xclip wmctrl x11-utils \
    xterm tmux python3 python3-pip python3-venv procps \
    && rm -rf /var/lib/apt/lists/*

COPY steer/ /opt/steer/
COPY entrypoint.sh /opt/entrypoint.sh
COPY test-poc.sh /opt/test-poc.sh
RUN chmod +x /opt/entrypoint.sh /opt/steer/steer /opt/test-poc.sh

RUN useradd -m -s /bin/bash agent
USER agent
WORKDIR /home/agent

ENTRYPOINT ["/opt/entrypoint.sh"]
```

### How each layer maps to the internals

**`FROM ubuntu:24.04`** - this is the bottom overlayfs layer. It contains the complete
Ubuntu 24.04 root filesystem: `/bin`, `/lib`, `/usr`, `/etc`, etc. When you pull this
image, Docker downloads its layers and stores them in `/var/lib/docker/overlay2/`.

**`RUN apt-get update && apt-get install ...`** - this creates a new overlayfs layer
containing all the files added by `apt-get install`. The `&& rm -rf /var/lib/apt/lists/*`
at the end removes the apt cache in the SAME layer, so the cache files do not consume
space. If `rm` were in a separate `RUN` instruction, it would create a new layer with
whiteout files, but the data would still exist in the previous layer (layers are immutable
once created). This is a common Dockerfile optimization.

**`COPY steer/ /opt/steer/`** - another layer, containing the steer wrapper scripts.

**`RUN chmod +x ...`** - another layer, containing the modified file metadata. Even though
only permissions changed, OverlayFS stores a full copy of each modified file in the new
layer (copy-on-write at the file level, not the byte level).

**`USER agent`** - this does not create a layer. It sets metadata in the image that tells
the runtime to run the container process as the `agent` user.

### The steer architecture

```
+----------------------------------------------------------------+
| Container (midget)                                              |
|                                                                 |
|  entrypoint.sh (PID 1 initially, then exec replaces it)        |
|    |                                                            |
|    +-- Xvfb :99 (virtual X11 display - framebuffer in memory)  |
|    |     Creates /tmp/.X11-unix/X99 (Unix domain socket)        |
|    |                                                            |
|    +-- fluxbox (window manager on :99)                          |
|    |     Manages window focus, raise, decorations               |
|    |                                                            |
|    +-- [target process] (PID 1 after exec "$@")                 |
|          |                                                      |
|          +-- xdotool: sends keyboard/mouse events to :99        |
|          +-- scrot: captures screenshots from :99               |
|          +-- xclip: clipboard operations                        |
|          +-- wmctrl: window manipulation                        |
|                                                                 |
|  All processes connect to DISPLAY=:99 via the Unix socket       |
|  The socket exists in the container's mount namespace            |
+----------------------------------------------------------------+
```

**Xvfb** (X Virtual Framebuffer) creates a virtual X11 display. It renders to a memory
buffer instead of a physical screen. X11 clients (like xterm, browsers, any GUI
application) connect to it via the Unix socket at `/tmp/.X11-unix/X99`. This socket
exists in the container's mount namespace - the host cannot see it (unless you explicitly
share the X11 socket).

**fluxbox** is a minimal window manager. Without a window manager, X11 windows cannot be
focused, raised, or positioned. The agent uses `xdotool` and `wmctrl` to interact with
windows, and these operations require a window manager to function.

**xdotool** sends synthetic keyboard and mouse events. `xdotool type "hello"` sends
keypress events for h-e-l-l-o to the focused window. `xdotool mousemove 100 200 click 1`
moves the mouse to (100,200) and clicks. This is how the agent "interacts" with GUI
applications.

**scrot** captures screenshots. `scrot /tmp/screenshot.png` renders the current state of
the virtual display to a PNG file. The agent takes screenshots to "see" what is on the
screen, processes them (OCR or vision model), and decides what to do next.

This is the "steer" architecture: see the screen (scrot) then send input (xdotool). The
agent controls GUI applications the same way a human does - by looking at pixels and
moving a mouse/keyboard. The container provides the sandboxed display environment where
this interaction happens.

### Observing the container from the host

```bash
# Build and run the midget container
docker build -t midget .
docker run -d --name midget-test midget sleep 3600

# Find the container's main process on the host
docker inspect --format '{{.State.Pid}}' midget-test
# e.g., 54321

# Examine its namespaces
ls -la /proc/54321/ns/
# Each namespace has a unique inode

# Check what cgroup it is in
cat /proc/54321/cgroup
# 0::/docker/<container-id>

# See its overlayfs mount from the host
docker inspect --format '{{.GraphDriver.Data.MergedDir}}' midget-test
# /var/lib/docker/overlay2/<hash>/merged

# List files in the container's root filesystem from the host
sudo ls /var/lib/docker/overlay2/<hash>/merged/
# bin  etc  home  lib  opt  proc  root  run  sbin  tmp  usr  var

# See the upper (writable) layer
docker inspect --format '{{.GraphDriver.Data.UpperDir}}' midget-test
# /var/lib/docker/overlay2/<hash>/diff
sudo ls /var/lib/docker/overlay2/<hash>/diff/
# Only files the container has written/modified since starting

# See the container's processes from the host
ps --forest -o pid,ppid,user,comm -g $(docker inspect --format '{{.State.Pid}}' midget-test)

# Clean up
docker rm -f midget-test
```

> **AGENTIC GROUNDING:** The Xvfb display (:99) exists in the container's mount namespace
> as a Unix socket at `/tmp/.X11-unix/X99`. If you need to observe what the agent "sees,"
> you can `docker exec` into the container and run `scrot /tmp/debug.png`, then
> `docker cp midget-test:/tmp/debug.png .` to copy it out. Alternatively, you can expose
> the display over VNC by adding a VNC server to the container. Either way, you are
> crossing namespace boundaries to observe agent behavior - understanding the namespaces
> tells you what is possible and what requires explicit configuration.

---

## Challenges

### Challenge: Build a Container from Scratch

*Estimated time: 30 minutes*

Using only `unshare`, `mount`, `chroot` (or `pivot_root`), and standard tools, create a
minimal "container" - a process with its own PID namespace, mount namespace, and UTS
namespace, running in a minimal root filesystem.

**Step 1: Get a minimal root filesystem**

```bash
# Option A: Debootstrap a minimal Debian root
sudo apt-get install -y debootstrap
sudo debootstrap --variant=minbase bookworm /tmp/mycontainer http://deb.debian.org/debian

# Option B: Download Alpine's minirootfs (smaller, faster)
mkdir -p /tmp/mycontainer
wget -O /tmp/alpine.tar.gz \
  https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.1-x86_64.tar.gz
sudo tar xzf /tmp/alpine.tar.gz -C /tmp/mycontainer
```

**Step 2: Create the namespaced process**

```bash
# Create new PID, mount, and UTS namespaces
sudo unshare --pid --mount --uts --fork bash

# Inside the new namespaces:

# Set a custom hostname
hostname my-container
hostname
# Output: my-container

# Mount proc for the new PID namespace
mount -t proc proc /tmp/mycontainer/proc

# Mount sysfs
mount -t sysfs sys /tmp/mycontainer/sys

# Mount a tmpfs for /tmp
mount -t tmpfs tmp /tmp/mycontainer/tmp

# Change root to the minimal filesystem
chroot /tmp/mycontainer /bin/sh

# You are now in your "container"
# Verify isolation:

# PID namespace: you are PID 1
ps aux
# Only shows processes in this namespace

# UTS namespace: custom hostname
hostname
# my-container

# Mount namespace: own mount tree
mount
# Shows the mounts you created, not the host's

# Filesystem: the minimal root
ls /
# bin  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var

# Exit
exit
```

**Verification criteria:**
- [ ] The process sees itself as PID 1
- [ ] The hostname is different from the host
- [ ] `ps` shows only processes in the namespace
- [ ] The filesystem root is the minimal rootfs, not the host's `/`
- [ ] From another terminal on the host, the process is visible with a normal host PID

**Stretch goal:** Replace `chroot` with `pivot_root` (the mechanism Docker actually uses).
`pivot_root` swaps the root filesystem and allows unmounting the old root entirely.
`chroot` merely changes the path resolution start point but the old root is still
accessible in the kernel's mount tree.

```bash
# Inside the unshare'd namespace, before chroot:
# pivot_root requires the new root to be a mount point
mount --bind /tmp/mycontainer /tmp/mycontainer
cd /tmp/mycontainer
mkdir -p oldroot
pivot_root . oldroot
# Now / is the new rootfs, /oldroot is the old host root

# Unmount the old root
umount -l /oldroot
rmdir /oldroot
# The old host root is completely inaccessible
```

---

### Challenge: Cgroup Resource Jail

*Estimated time: 15 minutes*

Create a cgroup that limits memory to 50MB and CPU to 50%, then test the enforcement.

```bash
# Create the cgroup
sudo mkdir /sys/fs/cgroup/jail-test

# Enable controllers
printf '+memory +cpu +pids' | sudo tee /sys/fs/cgroup/jail-test/cgroup.subtree_control

# Create a child cgroup (processes go in leaf cgroups in v2)
sudo mkdir /sys/fs/cgroup/jail-test/worker

# Set memory limit: 50MB
printf '52428800' | sudo tee /sys/fs/cgroup/jail-test/worker/memory.max

# Set CPU limit: 50% of one core
printf '50000 100000' | sudo tee /sys/fs/cgroup/jail-test/worker/cpu.max

# Set PID limit: 10 processes max
printf '10' | sudo tee /sys/fs/cgroup/jail-test/worker/pids.max

# Start a shell in the cgroup
sudo bash -c 'printf "$$" > /sys/fs/cgroup/jail-test/worker/cgroup.procs && exec bash'
```

Now test from inside the jailed shell:

```bash
# Test 1: Memory limit
# Try to allocate 60MB - should be OOM killed
python3 -c "x = bytearray(60 * 1024 * 1024); print('allocated')"
# Killed

# Check dmesg on the host (from another terminal):
dmesg | tail -5
# Should show OOM killer log

# Test 2: Allocate under the limit - should work
python3 -c "x = bytearray(40 * 1024 * 1024); print('allocated 40MB OK')"
# allocated 40MB OK

# Test 3: Monitor memory usage
cat /sys/fs/cgroup/jail-test/worker/memory.current
# Shows bytes currently used

# Test 4: PID limit (try a fork bomb)
# WARNING: This is safe because the cgroup limits it to 10 processes
:(){ :|:& };:
# bash: fork: retry: Resource temporarily unavailable
# The fork bomb is contained!

# Test 5: CPU stress
# Run a CPU-intensive task and observe it is throttled
python3 -c "
import time
start = time.time()
x = 0
while time.time() - start < 5:
    x += 1
print(f'iterations in 5 seconds: {x}')
"
# Compare the iteration count to running outside the cgroup
# It should be roughly half (50% CPU limit)
```

**Cleanup:**

```bash
# Exit the jailed shell
exit

# Remove the cgroup (must be empty)
sudo rmdir /sys/fs/cgroup/jail-test/worker
sudo rmdir /sys/fs/cgroup/jail-test
```

**Questions to answer:**
1. What happens if you set `memory.max` lower than the current `memory.current`?
2. What is the difference between `memory.max` and `memory.high`?
3. Why do you need a child cgroup (`worker`) rather than putting processes directly in `jail-test` when `subtree_control` is configured?

---

### Challenge: OverlayFS by Hand

*Estimated time: 15 minutes*

Create an overlay mount, perform operations, and observe the results in each layer.

```bash
# Setup
mkdir -p /tmp/ofs/{lower1,lower2,upper,work,merged}

# Create two lower layers (simulating Docker image layers)
# Lower1: base system files
printf 'base config\n' > /tmp/ofs/lower1/config.txt
printf 'base data\n' > /tmp/ofs/lower1/data.txt
mkdir -p /tmp/ofs/lower1/etc
printf 'base-host\n' > /tmp/ofs/lower1/etc/hostname

# Lower2: application layer (overrides some base files)
printf 'app config override\n' > /tmp/ofs/lower2/config.txt
printf 'app readme\n' > /tmp/ofs/lower2/README.md

# Mount with multiple lower layers (lower2 is on top of lower1)
sudo mount -t overlay overlay \
  -o lowerdir=/tmp/ofs/lower2:/tmp/ofs/lower1,upperdir=/tmp/ofs/upper,workdir=/tmp/ofs/work \
  /tmp/ofs/merged
```

**Tasks:**

1. List the merged view. Which version of `config.txt` do you see? Why?

```bash
cat /tmp/ofs/merged/config.txt
# Should show "app config override" - lower2 is on top of lower1
```

2. Verify that files from both layers are visible:

```bash
ls /tmp/ofs/merged/
# config.txt  data.txt  etc  README.md
# config.txt comes from lower2 (top), data.txt from lower1, README.md from lower2
```

3. Modify a file and find the copy-on-write:

```bash
printf 'modified by container\n' > /tmp/ofs/merged/data.txt

# Where is the modified version?
cat /tmp/ofs/upper/data.txt
# modified by container

# Is the original intact?
cat /tmp/ofs/lower1/data.txt
# base data
```

4. Create a new file and find it:

```bash
printf 'new file\n' > /tmp/ofs/merged/new.txt

ls /tmp/ofs/upper/
# data.txt  new.txt
```

5. Delete a lower-layer file and find the whiteout:

```bash
rm /tmp/ofs/merged/README.md

# Merged view - gone
ls /tmp/ofs/merged/
# config.txt  data.txt  etc  new.txt (no README.md)

# Lower layer - still there
ls /tmp/ofs/lower2/
# config.txt  README.md (untouched)

# Upper layer - whiteout file
sudo ls -la /tmp/ofs/upper/
# README.md should show as character device (0,0) - the whiteout marker
sudo stat /tmp/ofs/upper/README.md
```

6. Delete a directory from the lower layer and find the opaque marker:

```bash
rm -rf /tmp/ofs/merged/etc

# Check the upper layer
sudo ls -la /tmp/ofs/upper/
# etc should exist as an opaque directory

# Check for the opaque xattr
sudo getfattr -n trusted.overlay.opaque /tmp/ofs/upper/etc 2>/dev/null
# trusted.overlay.opaque="y"
```

**Cleanup:**

```bash
sudo umount /tmp/ofs/merged
rm -rf /tmp/ofs
```

---

### Challenge: Inspect the Midget Container

*Estimated time: 15 minutes*

Run the project's Docker container and examine it from both the host and inside perspectives.

```bash
# Build and run
docker build -t midget .
docker run -d --name midget-inspect --memory 512m --cpus 1.5 midget sleep 3600

# Get the container's host PID
HOST_PID=$(docker inspect --format '{{.State.Pid}}' midget-inspect)
printf 'Container main PID on host: %s\n' "$HOST_PID"
```

**From the host, examine:**

```bash
# 1. Namespaces
ls -la /proc/$HOST_PID/ns/
# Note the inode numbers

# Compare with your shell's namespaces
ls -la /proc/self/ns/
# Different inodes = different namespaces

# 2. Cgroup membership
cat /proc/$HOST_PID/cgroup
# Shows the cgroup path

# 3. Cgroup limits
# Find the cgroup path on disk
CGROUP=$(cat /proc/$HOST_PID/cgroup | cut -d: -f3)
# Read the limits
cat /sys/fs/cgroup${CGROUP}/memory.max
cat /sys/fs/cgroup${CGROUP}/cpu.max
cat /sys/fs/cgroup${CGROUP}/pids.current

# 4. OverlayFS mount
docker inspect --format '{{.GraphDriver.Data.MergedDir}}' midget-inspect
docker inspect --format '{{.GraphDriver.Data.UpperDir}}' midget-inspect
docker inspect --format '{{.GraphDriver.Data.LowerDir}}' midget-inspect

# 5. Count the image layers
docker inspect --format '{{.GraphDriver.Data.LowerDir}}' midget-inspect | tr ':' '\n' | wc -l

# 6. What user is the process running as?
ps -o pid,uid,user,comm -p $HOST_PID
# Should show the "agent" user (mapped to a UID on the host)
```

**From inside the container:**

```bash
docker exec -it midget-inspect bash

# 1. What PID do you see yourself as?
ps aux
# PID 1 should be sleep 3600 (or the entrypoint)

# 2. Can you see host processes?
ps aux | wc -l
# Should show only container processes, not hundreds of host processes

# 3. What is the hostname?
hostname
# The container ID (Docker default)

# 4. What network interfaces exist?
ip addr 2>/dev/null || cat /proc/net/dev
# eth0 and lo only

# 5. What is the root filesystem?
mount | grep overlay
# Shows the overlayfs mount

# 6. Can you see the host's /proc?
cat /proc/1/cmdline | tr '\0' ' '
# Shows the container's PID 1, not systemd

# 7. What user are you?
id
# uid=1000(agent) gid=1000(agent) - non-root

exit
```

**Cleanup:**

```bash
docker rm -f midget-inspect
```

---

### Challenge: Namespace Escape Scenarios

*Estimated time: 15 minutes*

These demonstrations show how misconfiguration weakens container isolation. Run in a
test environment only.

**Scenario 1: `--pid host` breaks PID isolation**

```bash
# Normal container - isolated PID namespace
docker run --rm ubuntu:24.04 ps aux | wc -l
# 2-3 lines (only container processes)

# With --pid host - shared PID namespace
docker run --rm --pid host ubuntu:24.04 ps aux | wc -l
# Hundreds of lines (all host processes visible)

# The container can see (and potentially signal) host processes
docker run --rm --pid host ubuntu:24.04 ps aux | grep dockerd
# Shows the Docker daemon - the container can see it
```

**Scenario 2: `--network host` breaks network isolation**

```bash
# Normal container - isolated network
docker run --rm ubuntu:24.04 ip addr
# Only eth0 (veth) and lo

# With --network host - shared network namespace
docker run --rm --network host ubuntu:24.04 ip addr
# All host network interfaces visible
# Container can bind to any host port
# Container can reach any service on localhost
```

**Scenario 3: Volume mount exposes host filesystem**

```bash
# Mount the host root into the container
docker run --rm -v /:/hostroot:ro ubuntu:24.04 ls /hostroot/etc/shadow
# The container can read the host's shadow file (password hashes)

# With read-write mount:
docker run --rm -v /:/hostroot ubuntu:24.04 touch /hostroot/tmp/container-was-here
ls -la /tmp/container-was-here
# The container wrote to the host filesystem
rm /tmp/container-was-here
```

**Questions to answer:**
1. If you must give a container access to host processes (e.g., for monitoring), what is
   the minimum exposure? (Hint: consider mounting specific `/proc` entries read-only
   instead of sharing the PID namespace.)
2. If a container needs to reach one specific host service, what is safer than
   `--network host`? (Hint: Docker networks and service discovery.)
3. Why is `-v /var/run/docker.sock:/var/run/docker.sock` particularly dangerous?
   (The container can control the Docker daemon - create new privileged containers, mount
   host filesystem, etc. This is effectively root on the host.)

---

### Challenge: Container Networking Deep Dive

*Estimated time: 20 minutes*

Trace a packet between two containers to understand how Docker networking uses network
namespaces and bridges.

```bash
# Create a custom network
docker network create testnet

# Run two containers on it
docker run -d --name box1 --network testnet ubuntu:24.04 sleep 3600
docker run -d --name box2 --network testnet ubuntu:24.04 sleep 3600

# Install networking tools in both
docker exec box1 apt-get update -qq
docker exec box1 apt-get install -y -qq iproute2 iputils-ping tcpdump > /dev/null 2>&1
docker exec box2 apt-get update -qq
docker exec box2 apt-get install -y -qq iproute2 iputils-ping tcpdump > /dev/null 2>&1
```

**Task 1: Examine network namespaces from inside**

```bash
# Box 1's network view
docker exec box1 ip addr
# eth0: 172.18.0.2/16 (or similar)

# Box 2's network view
docker exec box2 ip addr
# eth0: 172.18.0.3/16

# Both see their own isolated network stack
```

**Task 2: Examine from the host**

```bash
# Host sees the bridge and veth pairs
ip link | grep -A1 "br-"
# br-<hash>: the bridge for "testnet"

ip link | grep veth
# Two veth interfaces (one per container)

# Each veth is one end of a virtual cable
# The other end is eth0 inside the container
```

**Task 3: Ping between containers**

```bash
# Get box2's IP
BOX2_IP=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' box2)

# Ping from box1 to box2
docker exec box1 ping -c 3 $BOX2_IP
```

**Task 4: Trace the packet path**

```bash
# In terminal 1: capture on the bridge (host)
BRIDGE=$(docker network inspect testnet --format '{{.Id}}' | cut -c1-12)
sudo tcpdump -i "br-${BRIDGE}" icmp -c 6 &

# In terminal 2: capture inside box2
docker exec box2 tcpdump -i eth0 icmp -c 3 &

# In terminal 3: send the ping
docker exec box1 ping -c 3 $BOX2_IP

# Observe: the packet appears on the bridge AND inside box2
# Path: box1 eth0 -> veth (host) -> bridge -> veth (host) -> box2 eth0
```

**Task 5: Enter a container's network namespace from the host**

```bash
# Get container PID
BOX1_PID=$(docker inspect --format '{{.State.Pid}}' box1)

# Enter only the network namespace (keep host mount namespace)
sudo nsenter -t $BOX1_PID --net ip addr
# Shows box1's network view, but you are still on the host filesystem

# This is useful for debugging: run host tools in the container's network context
sudo nsenter -t $BOX1_PID --net ss -tlnp
# Shows listening sockets in box1's network namespace
```

**Cleanup:**

```bash
docker rm -f box1 box2
docker network rm testnet
```

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What is a container, structurally? (Not "like a lightweight VM" - what kernel features
   create it?)

2. How many kernel features does Docker compose to create a container? Name each one and
   what it controls.

3. If a process is PID 1 inside a container and PID 54321 on the host, what mechanism
   creates this dual view?

4. Why does `exec "$@"` in an entrypoint script matter for signal handling?

5. What is a whiteout file in OverlayFS? Why is it needed?

6. Where do writes inside a container go? Why do they disappear when the container is
   removed?

7. What is the difference between a Docker volume and a file written inside the
   container?

8. Why can a kernel exploit escape a container but not a VM?

9. What does `--privileged` actually do? Why should you never use it for agent containers?

10. How does `docker exec` work at the namespace level?

---

## Recommended Reading

- **Linux Kernel Documentation: namespaces** - `man 7 namespaces`, `man 7 cgroups`,
  `man 7 pid_namespaces`, `man 7 network_namespaces`, `man 7 user_namespaces`. The man
  pages are precise and authoritative.

- **"Containers from Scratch"** - Liz Rice's talk and blog series. Builds a container
  runtime in Go using raw syscalls. The best practical introduction to container internals.

- **cgroups v2 documentation** - `Documentation/admin-guide/cgroup-v2.rst` in the kernel
  source. Authoritative reference for cgroup controllers and their interfaces.

- **The OCI Runtime Specification** - defines the standard for container runtimes (what
  namespaces, cgroups, mounts, etc. must be configured). `runc` is the reference
  implementation.

- **"Understanding and Hardening Linux Containers"** - NCC Group whitepaper. Systematic
  analysis of container security boundaries, attack surfaces, and hardening measures. The
  best single reference for container security engineering.

- **Plan 9 from Bell Labs** - `man 2 rfork` and the Plan 9 papers. The conceptual origin
  of per-process namespaces.

---

## What to Read Next

**[Step 10: Networking from the CLI](/bootcamp/10-networking-cli/)** - You have seen how Docker uses network namespaces,
veth pairs, and bridges to connect containers. Step 10 goes deeper into the networking
stack itself: TCP/IP fundamentals, `curl` for HTTP operations, `dig`/`nslookup` for DNS,
`ss` and `netstat` for socket inspection, `tcpdump` and `wireshark` for packet analysis,
and `openssl` for TLS inspection. When an agent container cannot reach an external service,
or when connections are dropping, or when TLS handshakes fail - you need the networking
mental model to diagnose from the command line. The container networking you saw in this
step (bridges, veth pairs, NAT) composes with the general networking concepts in Step 10.
