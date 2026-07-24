+++
title = "Thirteen bugs between local and production"
date = "2026-04-05"
description = "I deployed an event-sourced multi-agent fleet to Kubernetes on my second day of using it. Everything worked locally. Nothing worked in the cluster. The bugs were the interesting part."
tags = ["kubernetes", "containers", "deployment", "nats", "event-sourcing", "ai-agents", "debugging"]
draft = true

copy_metrics_version = 1
copy_word_count = 1764
copy_not_count = 10
copy_not_ratio = 0.00566893
+++

I deployed four AI advisors to a Kubernetes cluster on my second day of using Kubernetes. The system worked perfectly on my MacBook. In the cluster, it broke thirteen different ways, all in the gap between "runs locally" and "runs in a container on a remote node."

This is a catalogue of those thirteen bugs, what caused them, and what I learned about the assumptions that local development lets you get away with.

## What I was building

A fleet of AI advisory agents, each running as an independent pod. Same container image, different configuration - persona, domain focus, Telegram bot token. NATS JetStream as the event bus. Each advisor consumes events from a shared stream and maintains local SQLite projections. The architecture is event-sourced: the stream is the source of truth, projections rebuild on restart.

The Python tooling (`halos`) provides CLI commands - `trackctl` for metrics, `journalctl` for qualitative entries, `nightctl` for work tracking. These read from the local SQLite stores. The advisors use these tools to answer questions with real data.

Locally, everything talks to the same filesystem. `store/` is right there. Python finds it by walking up from `__file__`. The test suite (1,364 tests) passes. The event sourcing machinery works against a Docker NATS instance. Ship it.

## Bug 1: Your Python files aren't where you think they are

**Symptom:** `trackctl streak movement` → `PermissionError: [Errno 13] Permission denied: '/opt/hermes/store'`

**Cause:** Every halos module found the `store/` directory by walking up the filesystem from `__file__`:

```python
def _store_dir() -> Path:
    p = Path(__file__).resolve()
    for ancestor in p.parents:
        if (ancestor / "store").is_dir():
            return ancestor / "store"
    return Path.cwd() / "store"
```

Locally, `__file__` is something like `/Users/kai/code/halo/halos/trackctl/store.py`. Walking up hits `halo/`, which contains `store/`. Works.

In the container, `__file__` is `/opt/venv/lib/python3.13/site-packages/halos/trackctl/store.py`. Walking up hits `/opt/venv/lib/`, `/opt/venv/`, `/opt/`, `/`. None contain `store/`. Falls through to `Path.cwd() / "store"` which resolves to wherever the process happens to be running.

**Fix:** A shared path resolution module that checks environment variables first:

```python
def store_dir() -> Path:
    env = os.environ.get("HALO_STORE_DIR")
    if env:
        return Path(env)
    hermes = os.environ.get("HERMES_HOME")
    if hermes:
        p = Path(hermes) / "store"
        if p.is_dir():
            return p
    return Path.cwd() / "store"
```

Six modules had the same walk-up-from-`__file__` pattern. All replaced with one import.

**Lesson:** `__file__` ancestry works when your source tree and your data tree are the same tree. In containers, they never are.

## Bug 2: ConfigMaps are read-only and they don't tell you nicely

**Symptom:** `/sethome` command → `[Errno 16] Device or resource busy: '/opt/data/.config_lxvs2h9d.tmp' -> '/opt/data/config.yaml'`

**Cause:** I mounted `config.yaml` from a ConfigMap using `subPath`:

```yaml
volumeMounts:
  - name: advisor-config
    mountPath: /opt/data/config.yaml
    subPath: config.yaml
```

This makes `/opt/data/config.yaml` a read-only bind mount. The gateway's `/sethome` command tries to atomically replace it (write temp file, rename). The rename fails because the mount point is immutable. The error message - "Device or resource busy" - is technically correct and practically useless.

**Fix:** Mount ConfigMaps to a defaults directory. Copy to the data directory on startup. The copies are writable:

```yaml
volumeMounts:
  - name: advisor-config
    mountPath: /opt/defaults/config.yaml
    subPath: config.yaml
```

```bash
[ ! -f "$HERMES_HOME/config.yaml" ] && cp /opt/defaults/config.yaml "$HERMES_HOME/config.yaml"
```

**Lesson:** ConfigMap mounts with `subPath` are read-only even if the parent directory is writable. The failure mode is a filesystem error at write time, not a mount-time warning.

## Bug 3: Login shells reset your PATH

**Symptom:** `trackctl streak movement` → `exit 127` (command not found)

**Cause:** The gateway runs tools via `bash -lic` - a login interactive shell. On Debian, `/etc/profile` sets PATH to system defaults:

```
/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
```

The Dockerfile sets `ENV PATH="/opt/venv/bin:$PATH"` which affects the container's environment. But `bash -lic` reads `/etc/profile` which overwrites PATH. The venv is gone. Every Python CLI tool installed in the venv returns "command not found."

I verified this directly:

```bash
# From kubectl exec (inherits container env):
$ echo $PATH
/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# From bash -lic (login shell, reads /etc/profile):
$ bash -lic 'echo $PATH'
/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
```

**Fix:** Write the venv PATH to `~/.bashrc` on pod startup:

```bash
echo 'export PATH="/opt/venv/bin:$PATH"' >> ~/.bashrc
```

Login shells source `~/.bashrc` after `/etc/profile`, so the venv PATH is restored.

**Lesson:** Docker `ENV` sets the container's environment. Login shells ignore it and rebuild PATH from system profiles. If your application spawns login shells (and many do - it's common in agent frameworks that need a "real" shell environment), you need the PATH in `.bashrc` or `.profile`, not just in the Dockerfile.

## Bug 4: `imagePullPolicy` doesn't do what you think for mutable tags

**Symptom:** New image pushed, pods restarted, but running old code. `halos.common.paths` module doesn't exist even though it's in the image.

**Cause:** The image tag was `fleet-latest`. Kubernetes only defaults to `imagePullPolicy: Always` for the exact tag `latest`. Any other tag - including `fleet-latest`, `dev-latest`, `my-latest` - defaults to `IfNotPresent`. The node had the old image cached. The new push was invisible.

**Fix:** Explicit `imagePullPolicy: Always` on every container:

```yaml
image: lhr.vultrcr.com/jeany/halo:fleet-latest
imagePullPolicy: Always
```

**Lesson:** Kubernetes image pull behaviour matches the literal tag string. If your tag is mutable and you expect fresh pulls, you must say so explicitly.

## Bug 5: Relative paths don't survive containerisation

**Symptom:** Advisor reads persona file at `data/finance/ark-accounting/CANONICAL-POSITION-2026-04-01.md`. File tool returns error. File exists at that path from the container's working directory.

**Cause:** The gateway's file-reading tool resolves paths relative to its own notion of "project root," not the container's cwd. The file was at `/opt/data/data/finance/...` but the tool searched elsewhere. `find . -name "*finance*"` from `kubectl exec` found it immediately, but the tool's sandboxed search didn't.

**Fix:** Absolute paths in all advisor prompts:

```
/opt/data/data/finance/ark-accounting/CANONICAL-POSITION-2026-04-01.md
```

**Lesson:** Relative paths work when everyone agrees on the root. In containers, the application, the shell, and the tool framework may all have different opinions about where "here" is.

## Bug 6: `uv run` doesn't exist in the container

**Symptom:** Advisor tries `uv run trackctl streak movement` → command not found.

**Cause:** The advisor's persona file (written for local development) prefixed every CLI command with `uv run`. The container doesn't have `uv`. The tools are installed directly in the venv - `trackctl` is already on PATH (once bug 3 is fixed). The `uv run` prefix is a local development artefact.

**Fix:** Strip `uv run` from all advisor prompts.

**Lesson:** Development tooling leaks into documentation. When your prompts reference how *you* run commands, they break when someone (or something) else runs them differently.

## Bug 7: NATS JetStream needs more subjects than you expect

**Symptom:** Advisor can publish but JetStream operations (stream info, consumer creation) fail with permission errors.

**Cause:** I initially scoped NATS subscribe permissions to `halo.>` - the application's subject namespace. But JetStream's request-reply protocol uses `_INBOX.>` for responses and `$JS.API.>` for stream management. Restricting subscribe to `halo.>` blocked the internal protocol.

**Fix:** Subscribe permission set to `>` (all subjects). The auth boundary is the credential itself, not subject filtering.

**Lesson:** JetStream is not just pub-sub. It's a protocol with its own internal subjects. Scoping permissions to your application namespace breaks the protocol layer underneath.

## Bug 8: NATS config and CLI args conflict silently

**Symptom:** NATS server crashes on startup with `Duplicate 'store_dir' configuration`.

**Cause:** `store_dir` was specified both as a CLI argument (`--store_dir=/data`) and in `nats.conf`. The NATS server treats this as a fatal conflict.

**Fix:** All configuration in `nats.conf`. CLI args limited to `--config=/etc/nats/nats.conf`.

**Lesson:** NATS configuration has two input channels, file and CLI, which collide when they define the same value. Pick one.

## Bug 9: JetStream max_file must exceed your stream

**Symptom:** Stream creation fails with `insufficient storage resources available` even though disk is empty.

**Cause:** JetStream's `max_file` config was set to 5GB. The stream's `max_bytes` was also 5GB. JetStream needs headroom above the stream limit for metadata and operational overhead.

**Fix:** `max_file` set to 2× the largest stream's `max_bytes`.

**Lesson:** JetStream storage limits are not the same as disk limits. The engine needs breathing room.

## Bug 10: VKE node pools can't be resized

**Symptom:** Terraform apply for plan change succeeds silently. Node pool unchanged.

**Cause:** Vultr VKE node pool plans are immutable after creation. The API accepts the update request and returns success. Nothing changes. No error, no warning.

**Fix:** Create a new node pool with the desired plan, drain the old one, delete it. The API lies about mutability.

**Lesson:** A "200 OK" can still conceal an unperformed mutation. Some cloud APIs accept changes they can't perform and silently discard them.

## Bug 11: You can't push a 4GB image from home

**Symptom:** `docker push` to GHCR hangs indefinitely. To Vultr CR, times out after 30 minutes.

**Cause:** Residential internet upload speeds. The image is ~1.5GB compressed. GHCR is across the Atlantic. Even Vultr CR (same city as the cluster) couldn't complete the push reliably.

**Fix:** GitHub Actions builds and pushes the image. GitHub's runners have datacenter-grade networking. The push that took forever from my MacBook completes in under 2 minutes from a runner.

**Lesson:** Container images are large artefacts. Build them where the bandwidth is, not where the code is.

## Bug 12: Kaniko can't run under restricted pod security

**Symptom:** Kaniko build pod fails with security context errors.

**Cause:** Kaniko needs root to build container images (it manipulates filesystem layers). VKE's restricted pod security standard blocks root containers.

**Fix:** Don't build in-cluster. Use GitHub Actions.

**Lesson:** In-cluster builds require privileged containers. Most managed Kubernetes offerings restrict this by default. The CI-builds-and-pushes pattern exists for a reason.

## Bug 13: Vultr's container registry deletion API doesn't work

**Symptom:** Old image tags accumulate, registry fills up. Delete requests return 500.

**Cause:** The Vultr API endpoint `DELETE /registry/{id}/repository/{name}/tag/{tag}` returns `Controllers\VCRController:deleteRepositoryTag is not resolvable`. Repository-level deletion also 500s. The CLI wraps the same broken endpoint.

**Fix:** None. Upgraded the registry plan from free (10GB) to Business (20GB, $5/mo). Switched to single-tag strategy (`fleet-latest` only) to minimise accumulation.

**Lesson:** Cloud provider APIs have bugs. When the API for cleaning up resources is broken, the resources accumulate and you pay for it. Budget for provider limitations.

## The pattern

The application logic still worked: event sourcing, projection replay, the test suite and the advisor responses all behaved correctly.

Every bug was in the gap between two correct things:
- Code that works + a filesystem that's structured differently
- A PATH that's set + a shell that resets it
- An image that's pushed + a node that doesn't pull it
- A config that's applied + a mount that's read-only
- An API that accepts the request + a backend that ignores it

Local development is a lie of omission. Everything works because everything shares the same user, the same filesystem, the same PATH, the same assumptions. Containers strip those assumptions away and what's left is the actual contract between your code and its environment. Thirteen times, the contract wasn't what I thought it was.

The fix in every case was the same pattern: make the dependency explicit. Environment variables instead of filesystem walks. Absolute paths instead of relative ones. Explicit pull policies instead of implicit defaults. `.bashrc` entries instead of Dockerfile ENV. Documentation for every gotcha so the next deployment - or the next person - doesn't pay the same tax.

## The system

Four advisors are live. Musashi (body), Socrates (craft), Medici (money), Machiavelli (power). Each runs as a Hermes gateway pod, consuming events from a NATS JetStream, maintaining local projections, responding on Telegram. Resource usage at idle: 2m CPU, 90Mi memory per pod. The whole fleet plus NATS plus monitoring fits on a single 2-vCPU, 4GB node with room to spare.

The event sourcing makes projections disposable because they rebuild from the stream on restart. Each advisor can run without its own PVC or a backup strategy for ephemeral state; the stream is the backup.

A 5MB init container carries the Python tooling and overlays it into pods via PYTHONPATH. When I change a halos module, the image builds in 30 seconds and pods restart with fresh code. The base image (Hermes + system deps) only rebuilds when the runtime changes.

Twenty-eight commits in one day. Thirteen bugs, all documented, all fixed, none repeated. The actual work of deployment was in the thirteen things between my laptop and the cluster that nobody warns you about because they seem too obvious to mention.

Those supposedly obvious details are the job.
