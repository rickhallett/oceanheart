+++
title = "Git Internals - Beyond Porcelain Commands"
date = "2026-03-10"
description = "Git's object model made transparent so every agent git operation can be verified at the object level, not just the porcelain level."
tags = ["git", "internals", "version-control", "plumbing", "bootcamp"]
step = 7
tier = 1
estimate = "4 hours"
bootcamp = 1
+++

Step 7 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 3 (filesystem as state) - you need the inode/directory/symlink model
**Leads to:** Step 8 (process observation)

---

## Why This Step Exists

Git is the most important tool in the agentic engineering stack. Agents make git operations
hundreds of times per session: add, commit, push, branch, merge, diff. When those operations
produce unexpected results - a detached HEAD, a merge conflict, lost commits, a dirty index -
porcelain commands show you symptoms. Plumbing commands show you the actual object state.

This project uses git plumbing directly in production:

- The Makefile uses `git write-tree` to compute a tree hash as an identity for staged content
  (Makefile:38). This solves the "SHA paradox" - you cannot include your own commit SHA in
  your content because the SHA changes when content changes, but you CAN use the tree hash
  of staged content.
- The POLECAT wrapper uses `git rev-parse HEAD` and `git diff --stat` for delta detection
  (Makefile:53-71). Before and after a polecat runs, the wrapper compares HEAD, diff output,
  and untracked files. If nothing changed, the polecat produced no delta - a noop.
- Commit message conventions (`[H:steer]`, `[H:correct]`) are part of the commit object,
  which changes the SHA. Understanding commit objects means understanding that the message
  is data, not decoration.

The goal: make git's object model transparent so that every agent git operation can be
verified at the object level, not just the porcelain level.

---

## Table of Contents

1. [Git Is a Content-Addressable Filesystem](#1-git-is-a-content-addressable-filesystem) (~30 min)
2. [Blobs](#2-blobs) (~20 min)
3. [Trees](#3-trees) (~30 min)
4. [Commits](#4-commits) (~30 min)
5. [The DAG (Directed Acyclic Graph)](#5-the-dag-directed-acyclic-graph) (~20 min)
6. [Refs and HEAD](#6-refs-and-head) (~30 min)
7. [The Index (Staging Area)](#7-the-index-staging-area) (~30 min)
8. [The Reflog](#8-the-reflog) (~20 min)
9. [Plumbing vs Porcelain](#9-plumbing-vs-porcelain) (~10 min)
10. [Challenges](#challenge-build-a-commit-by-hand) (~60 min)

---

## The Object Model - Overview

Before diving into details, here is the complete picture. Git has four object types
and a few pointer mechanisms. Everything else is built from these primitives.

```
                        ┌──────────────────┐
                        │       ref        │
                        │  (branch/tag)    │
                        │  just a file     │
                        │  containing a    │
                        │  SHA             │
                        └────────┬─────────┘
                                 │ points to
                                 v
                        ┌──────────────────┐
                        │     commit       │     ┌──────────────────┐
                        │                  │────>│  parent commit   │──> ...
                        │  tree: <sha>     │     └──────────────────┘
                        │  parent: <sha>   │
                        │  author: ...     │
                        │  message: ...    │
                        └────────┬─────────┘
                                 │ points to
                                 v
                        ┌──────────────────┐
                        │      tree        │
                        │  (directory)     │
                        │                  │
                        │  100644 blob <sha> file.txt
                        │  040000 tree <sha> lib/
                        │  100755 blob <sha> run.sh
                        └───┬──────────┬───┘
                            │          │
                   points to│          │points to
                            v          v
                  ┌────────────┐  ┌────────────┐
                  │    blob    │  │    tree     │
                  │  (file     │  │  (subdir)   │
                  │  content)  │  │             │
                  │            │  │  100644 blob <sha> mod.ts
                  │  "hello\n" │  │  ...        │
                  └────────────┘  └─────────────┘
```

Every object is identified by the SHA-1 hash of its content. Objects are immutable.
Once created, a SHA identifies that exact content forever. The entire version history
is a graph of these immutable objects connected by SHA references.

---

## 1. Git Is a Content-Addressable Filesystem

**Estimated time: 30 minutes**

A regular filesystem maps names to content: the path `/home/agent/file.txt` locates
a block of data. Git's object store maps content to names: the SHA-1 hash of the
content IS the name.

### The object store

All git objects live in `.git/objects/`. The first 2 characters of the SHA become a
directory name, the remaining 38 become the filename:

```bash
# An object with SHA e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 is stored at:
.git/objects/e6/9de29bb2d1d6434b8b29ae775ad8c2e48c5391
```

Objects are compressed with zlib. You never read them directly - you use plumbing
commands.

### Four object types

| Type | Purpose | Contains |
|------|---------|----------|
| **blob** | File content | Raw bytes (no filename, no permissions) |
| **tree** | Directory listing | Entries of (mode, type, sha, name) |
| **commit** | Snapshot + metadata | Tree SHA, parent SHA(s), author, committer, message |
| **tag** | Named pointer | Object SHA, tag name, tagger, message (annotated tags only) |

### Inspecting objects

Two plumbing commands do most of the work:

```bash
# What type is this object?
git cat-file -t HEAD
# commit

# Pretty-print this object's content
git cat-file -p HEAD
# tree 4b825dc642cb6eb9a060e54bf899d15f5a4f0f0e
# parent a1b2c3d4e5f6...
# author Richard Hallett <...> 1710000000 +0000
# committer Richard Hallett <...> 1710000000 +0000
#
# fix: resolve type error in auth module

# What size is this object (in bytes)?
git cat-file -s HEAD
# 274
```

### The content-addressable property

The SHA is computed from the content. Identical content always produces the same SHA.
Different content always produces a different SHA (within the collision resistance of
SHA-1, which is astronomically unlikely for non-adversarial use).

```bash
# Two files with the same content produce the same blob hash
echo "hello" > file1.txt
echo "hello" > file2.txt
git hash-object file1.txt
# ce013625030ba8dba906f756967f9e9ca394464a
git hash-object file2.txt
# ce013625030ba8dba906f756967f9e9ca394464a

# Same hash. Same blob. Git stores it once.
```

This is the same principle as inode deduplication from Step 3, but at the content level
rather than the filesystem level. Where two hard links share an inode, two identical
files in git share a blob object.

> **HISTORY:** Linus Torvalds wrote git in April 2005 in about two weeks, after the
> Linux kernel's previous VCS (BitKeeper) revoked its free license. The design goals
> were speed, data integrity, and support for distributed workflows. The content-
> addressable store was inspired by Monotone VCS. Torvalds said: "I'm an egotistical
> bastard, and I name all my projects after myself. First Linux, now git." (In British
> English, "git" is slang for a foolish person.)

---

## 2. Blobs

**Estimated time: 20 minutes**

A blob is the simplest object type. It stores a file's content - just the content. No
filename, no permissions, no timestamps. Those belong to the tree object that references
the blob.

### Creating and inspecting blobs

```bash
# Compute the hash of a file's content (without storing it)
echo "hello world" | git hash-object --stdin
# 95d09f2b10159347eece71399a7e2e907ea3df4f

# Compute AND store the blob in the object database
echo "hello world" | git hash-object -w --stdin
# 95d09f2b10159347eece71399a7e2e907ea3df4f

# Verify it is stored
git cat-file -t 95d09f2b
# blob

# Read its content back
git cat-file -p 95d09f2b
# hello world
```

### The hash computation

Git computes the SHA-1 of a header prepended to the content. The header is:
`blob <size>\0` where `<size>` is the content length in bytes and `\0` is a null byte.

```bash
# Manual computation (for understanding, not for use)
printf 'blob 12\0hello world\n' | sha1sum
# 95d09f2b10159347eece71399a7e2e907ea3df4f

# This is exactly what git hash-object computes
echo "hello world" | git hash-object --stdin
# 95d09f2b10159347eece71399a7e2e907ea3df4f
```

### Content deduplication

Because blobs are content-addressed, identical files across the entire repository
history share one blob. If `lib/auth/config.ts` and `lib/bouts/config.ts` have identical
content, git stores one blob. If you commit a file, delete it, and recreate it with the
same content ten commits later, it points to the same blob.

This is not an optimization. It is a structural consequence of content addressing.

> **AGENTIC GROUNDING:** When you review an agent's commit with `git show`, the diff
> shows added and removed lines. But the underlying reality is different: git stored
> new blob objects for every file that changed. Unchanged files still point to the same
> blobs. Understanding this means understanding that `git show` computes the diff on the
> fly by comparing the trees of the commit and its parent. The diff is not stored - it
> is derived.

---

## 3. Trees

**Estimated time: 30 minutes**

A tree object represents a directory. It contains a list of entries, each mapping a name
to a blob (file) or another tree (subdirectory), along with a file mode.

### Inspecting a tree

```bash
# Get the tree SHA from a commit
git cat-file -p HEAD
# tree 8f9234abcdef...

# Inspect the tree
git ls-tree 8f9234ab
# 100644 blob a1b2c3d4... AGENTS.md
# 100644 blob e5f6a7b8... Makefile
# 040000 tree c9d0e1f2... lib
# 040000 tree 3a4b5c6d... docs
# 120000 blob f7e8d9c0... CLAUDE.md

# Recursive listing (all files in all subdirectories)
git ls-tree -r HEAD
```

### File modes

| Mode | Meaning |
|------|---------|
| `100644` | Regular file (not executable) |
| `100755` | Executable file |
| `040000` | Subdirectory (tree object) |
| `120000` | Symbolic link |
| `160000` | Gitlink (submodule) |

These are the only modes git tracks. Git does not store full Unix permissions - it
only distinguishes executable from non-executable for regular files. The rest of the
permission bits come from the filesystem at checkout time, filtered through `core.fileMode`
and the system's umask (recall umask from Step 3).

### Building a tree from the index

The `git write-tree` command creates a tree object from the current index (staging area).
This is the command the project's Makefile uses:

```bash
# Stage some files
git add AGENTS.md Makefile lib/

# Create a tree object from the staged content
git write-tree
# 8f9234abcdef...
```

The tree object captures the exact state of the index at that moment. If you stage
different content and run `git write-tree` again, you get a different SHA.

This is what line 38 of the Makefile does:

```makefile
TREE := $(shell git write-tree 2>/dev/null | cut -c1-8)
```

It creates a tree object from whatever is currently staged, takes the first 8 characters
of the SHA, and uses it as an identity hash. This identity changes whenever the staged
content changes - and it does NOT change when the commit message changes (because the
tree represents content, not metadata).

> **AGENTIC GROUNDING:** `git write-tree` is how the project identifies builds. The tree
> hash represents "what files look like right now" without the commit metadata (message,
> author, timestamp). This solves the SHA paradox: if you tried to use the commit hash as
> an identity and embedded it in a file, the file's content would change, which would
> change the blob hash, which would change the tree hash, which would change the commit
> hash - an infinite loop. The tree hash of staged content breaks this cycle because it
> exists before the commit is created.

> **HISTORY:** The index was originally called the "cache" in early git documentation.
> You will still see references to "cached" in some commands: `git diff --cached` is
> the same as `git diff --staged`. The terminology shifted, but the old names persist
> in the plumbing layer.

---

## 4. Commits

**Estimated time: 30 minutes**

A commit object is the snapshot that ties everything together. It points to a tree (the
project state at that moment), one or more parent commits (the history), and carries
metadata (author, committer, message).

### Anatomy of a commit

```bash
git cat-file -p HEAD
```

Output:

```
tree 8f9234abcdef0123456789abcdef0123456789ab
parent a1b2c3d4e5f60123456789abcdef0123456789ab
author Richard Hallett <richard@oceanheart.ai> 1710000000 +0000
committer Richard Hallett <richard@oceanheart.ai> 1710000500 +0000

fix: resolve type error in auth module [H:correct]
```

The fields:

| Field | Purpose |
|-------|---------|
| `tree` | SHA of the tree object (the complete project snapshot) |
| `parent` | SHA of the parent commit(s). First commit has none. Merge commits have 2+. |
| `author` | Who wrote the change, with timestamp |
| `committer` | Who created the commit object, with timestamp. Usually same as author. |
| (blank line) | Separator between headers and message |
| message | The commit message. Everything after the blank line. |

### The commit is NOT the diff

This is the most important mental model correction for people who think of commits as
"changes." A commit is a complete snapshot - the tree SHA points to a tree that contains
every file in the project at that moment. The diff you see in `git show` or `git log -p`
is computed on the fly by comparing the commit's tree with its parent's tree.

```bash
# This shows the tree (snapshot), not the diff
git cat-file -p HEAD | head -1
# tree 8f9234abcdef...

# The tree contains EVERY file, not just changed ones
git ls-tree -r HEAD | wc -l
# 347  (every file in the project)

# The diff is computed by comparing two trees
git diff HEAD~1 HEAD
# Shows what changed between the two snapshots
```

This distinction matters when you need to verify an agent's commit. `git show` shows
the diff, which is useful for review. But `git ls-tree -r HEAD` shows the complete state,
which is useful for verification. Did the agent's commit result in a valid project state?
The tree answers that question; the diff does not.

### Creating commits with plumbing

```bash
# Porcelain: git commit -m "message"
# Plumbing equivalent:
tree_sha=$(git write-tree)
parent_sha=$(git rev-parse HEAD)
commit_sha=$(echo "fix: something" | git commit-tree "$tree_sha" -p "$parent_sha")
git update-ref refs/heads/main "$commit_sha"
```

This sequence is exactly what `git commit` does internally:
1. Create a tree from the index (`git write-tree`)
2. Get the current HEAD as the parent (`git rev-parse HEAD`)
3. Create a commit object pointing to the tree and parent (`git commit-tree`)
4. Update the current branch ref to point to the new commit (`git update-ref`)

### How commit tags affect the SHA

The project uses commit tags like `[H:steer]` and `[H:correct]` in commit messages.
Because the message is part of the commit object and the SHA is a hash of the entire
object, changing a single character in the message produces a completely different SHA.

```bash
# These two commits would have different SHAs even if they point to
# the same tree and parent:
echo "fix: auth bug" | git commit-tree "$tree" -p "$parent"
# a1b2c3d4...
echo "fix: auth bug [H:correct]" | git commit-tree "$tree" -p "$parent"
# e5f6a7b8...
```

The tree is the same. The parent is the same. Only the message differs. But the commit
SHA is completely different. This is why `git write-tree` is used for identity instead of
the commit SHA - the tree hash is independent of metadata.

> **AGENTIC GROUNDING:** When you use `git cat-file -p HEAD`, you see exactly what tree
> the commit points to. You can then `git ls-tree` that tree to see every file,
> recursively. This is how you verify that an agent's commit contains exactly what it
> should. If an agent claims it only changed `lib/auth/login.ts` but the tree diff shows
> changes in `lib/bouts/scoring.ts`, you have a discrepancy. The plumbing commands give
> you the ground truth; the porcelain gives you the agent's narrative about that truth.

---

## 5. The DAG (Directed Acyclic Graph)

**Estimated time: 20 minutes**

Commits form a graph through their parent pointers. Each commit points backward to its
parent(s). This graph is:

- **Directed** - edges point from child to parent (backward in time)
- **Acyclic** - no commit can be its own ancestor (SHA of content prevents cycles)

### Visualizing the DAG

```bash
# ASCII graph of the commit history
git log --graph --oneline --all --decorate

# Example output:
# * e5f6a7b (HEAD -> main) fix: auth module
# *   c3d4e5f Merge branch 'feature/scoring'
# |\
# | * a1b2c3d feat: add scoring engine
# | * 9f8e7d6 feat: scoring types
# |/
# * 7a6b5c4 chore: update deps
```

### Parent relationships

```
Regular commit (1 parent):

  A <── B <── C
                  (C's parent is B, B's parent is A)

Merge commit (2 parents):

  A <── B <── D (merge)
              ^
  A <── C ────┘
                  (D has two parents: B and C)

Initial commit (0 parents):

  A             (no parent pointer)
```

### Finding common ancestors

```bash
# Find the most recent common ancestor of two branches
git merge-base main feature/scoring
# 7a6b5c4...

# This is the point where the branches diverged
# It determines what a merge or rebase will do
```

### Merge vs rebase at the structural level

**Merge** creates a new commit with two parents:

```
Before:
  main:    A -- B -- C
  feature:      \-- D -- E

After merge:
  main:    A -- B -- C -- F (merge commit)
  feature:      \-- D -- E --/

F has two parents: C and E
```

**Rebase** creates new commits with new SHAs (because their parents changed):

```
Before:
  main:    A -- B -- C
  feature:      \-- D -- E

After rebase:
  main:    A -- B -- C
  feature:              \-- D' -- E'

D' and E' are NEW commits. Same diffs as D and E, but different SHAs
because their parent pointers changed. D' points to C (not B).
The original D and E become unreachable (but survive in the reflog).
```

This is why rebase rewrites history and merge preserves it. The distinction is structural,
not cosmetic.

> **AGENTIC GROUNDING:** When an agent rebases a branch and force-pushes, it creates
> new commit objects and discards old ones. If another agent or process had a reference to
> the old SHAs, those references are now broken. Understanding the DAG means understanding
> why force-pushing is destructive and why the project's standing orders prohibit it on
> main/master without explicit Operator approval.

---

## 6. Refs and HEAD

**Estimated time: 30 minutes**

A ref is simply a file containing a SHA. Branches, tags, and remote tracking branches
are all refs. They are the human-readable names layered on top of the SHA-based object
model.

### Branch refs

```bash
# A branch is a file containing a commit SHA
cat .git/refs/heads/main
# e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4

# This is what git rev-parse does
git rev-parse main
# e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4

# List all refs
git show-ref
```

When you make a new commit on a branch, git updates the ref file to contain the new
commit's SHA. That is all `git commit` does to the branch - it writes a new SHA to a file.

### HEAD

HEAD is how git knows "where you are." It is stored in `.git/HEAD`:

```bash
# Normal state: HEAD is a symbolic ref pointing to a branch
cat .git/HEAD
# ref: refs/heads/main

# This means "I am on the main branch"

# Detached HEAD state: HEAD points directly to a commit SHA
cat .git/HEAD
# e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4

# This means "I am at this specific commit, not on any branch"
```

Detached HEAD is not an error state. It is a specific state that means "the next commit
will not update any branch." It happens when you `git checkout <sha>` or `git checkout
<tag>`. It is how `git bisect` works.

### Tag refs

```bash
# Lightweight tag: just a ref file pointing to a commit
git tag v1.0
cat .git/refs/tags/v1.0
# e5f6a7b8...

# Annotated tag: a ref pointing to a tag OBJECT, which points to a commit
git tag -a v2.0 -m "Release 2.0"
git cat-file -t v2.0
# tag
git cat-file -p v2.0
# object e5f6a7b8...
# type commit
# tag v2.0
# tagger Richard Hallett <...> 1710000000 +0000
#
# Release 2.0
```

### Remote tracking refs

```bash
# Remote branches are refs too
cat .git/refs/remotes/origin/main
# e5f6a7b8...

# They are updated by git fetch, never by local commits
git fetch origin
# Updates .git/refs/remotes/origin/* to match the remote
```

### Moving refs with plumbing

```bash
# Move a branch to point to a different commit
git update-ref refs/heads/main a1b2c3d4

# Delete a ref
git update-ref -d refs/heads/old-branch

# Create a new branch pointing to a specific commit
git update-ref refs/heads/new-branch a1b2c3d4
```

### The key insight

All porcelain commands - `commit`, `merge`, `rebase`, `checkout`, `branch`, `reset` -
just manipulate refs and create objects. There is no magic. `git commit` creates a tree
from the index, creates a commit pointing to that tree, and updates the current branch
ref. `git branch feature` creates a new ref file. `git checkout main` updates HEAD to
point to `refs/heads/main` and updates the working tree.

The Makefile's `git rev-parse HEAD` (line 53) reads the SHA that HEAD currently points
to. It resolves the symbolic ref chain: HEAD -> refs/heads/main -> SHA. The returned
SHA is the commit, not the branch name. This is deterministic and machine-parseable,
which is why plumbing is used instead of porcelain.

> **AGENTIC GROUNDING:** `git rev-parse` is the universal "resolve this name to a SHA"
> command. The POLECAT wrapper uses `PRE_HEAD=$(git rev-parse HEAD)` before execution
> and `POST_HEAD=$(git rev-parse HEAD)` after, then compares. If the SHAs are equal,
> HEAD did not move - no new commit was made. This is delta detection at the ref level.
> Understanding refs means understanding that this comparison is checking whether the
> branch pointer file was updated, not whether any code changed (that is what
> `git diff --stat` checks separately).

---

## 7. The Index (Staging Area)

**Estimated time: 30 minutes**

The index is the most misunderstood part of git. It is a binary file at `.git/index`
that represents the next commit's tree. When you run `git add`, you are updating the
index. When you run `git commit`, git creates a tree from the index.

### Three states of a file

Git tracks three versions of every file:

```
HEAD (last commit)  <-->  Index (staging area)  <-->  Working tree (disk)
```

```bash
# Compare working tree to index
git diff
# Shows unstaged changes (what would NOT be in the next commit)

# Compare index to HEAD
git diff --cached    # or: git diff --staged
# Shows staged changes (what WOULD be in the next commit)

# Compare working tree to HEAD
git diff HEAD
# Shows all changes (staged + unstaged)
```

This three-way model is why `git add` exists as a separate step from `git commit`. The
index lets you selectively stage changes - commit some modifications while keeping others
as work in progress.

### Inspecting the index

```bash
# Show what is in the index
git ls-files --stage
# 100644 a1b2c3d4e5f6... 0    AGENTS.md
# 100644 e7f8a9b0c1d2... 0    Makefile
# 100644 3a4b5c6d7e8f... 0    lib/auth/login.ts
# ...

# The columns are: mode, blob SHA, stage number, path
# Stage 0 = normal. Stages 1-3 appear during merge conflicts.
```

### What `git add` actually does

When you run `git add file.txt`, git:

1. Computes the SHA of the file's content
2. Creates a blob object in `.git/objects/` containing that content
3. Updates the index entry for `file.txt` to point to the new blob SHA

```bash
# Before git add: the file is modified but the index still has the old blob
echo "new content" > file.txt
git diff             # shows the change (working tree vs index)
git diff --cached    # shows nothing (index vs HEAD is unchanged)

# After git add: the index is updated with the new blob
git add file.txt
git diff             # shows nothing (working tree matches index)
git diff --cached    # shows the change (index vs HEAD)
```

### What `git commit` actually does

When you run `git commit -m "message"`, git:

1. Creates a tree object from the index (`git write-tree`)
2. Gets the current HEAD commit SHA (`git rev-parse HEAD`)
3. Creates a commit object pointing to the tree, with HEAD as parent
4. Updates the current branch ref to point to the new commit
5. Clears the index's "dirty" state (index now matches HEAD)

No file copying happens. No diffs are stored. Git creates immutable objects and moves
a pointer.

### The index during merge conflicts

During a merge conflict, the index contains multiple stages for conflicted files:

```bash
# Stage 0: resolved (normal)
# Stage 1: common ancestor
# Stage 2: "ours" (current branch)
# Stage 3: "theirs" (branch being merged)

# During a conflict:
git ls-files --stage
# 100644 aaa... 1    lib/auth/login.ts   (ancestor)
# 100644 bbb... 2    lib/auth/login.ts   (ours)
# 100644 ccc... 3    lib/auth/login.ts   (theirs)

# After resolving and git add:
git ls-files --stage
# 100644 ddd... 0    lib/auth/login.ts   (resolved)
```

Understanding stages explains why `git add` marks a conflict as resolved - it replaces
the three conflict entries (stages 1, 2, 3) with a single resolved entry (stage 0).

> **AGENTIC GROUNDING:** The index is "the next commit you are building." When an agent
> runs `git add .` followed by `git commit`, it is staging ALL changes into the index
> and then creating a commit from that index. If the agent should only commit some files,
> it needs selective `git add`. When reviewing agent commits, `git ls-files --stage` on
> the index shows exactly what the agent staged. This is more precise than `git status`,
> which is a porcelain interpretation of the index state.

---

## 8. The Reflog

**Estimated time: 20 minutes**

The reflog is git's safety net. Every time a ref changes - commit, reset, checkout,
merge, rebase - git records the old and new SHA in a log file.

### Viewing the reflog

```bash
git reflog
# e5f6a7b HEAD@{0}: commit: fix: auth module
# c3d4e5f HEAD@{1}: merge feature/scoring: Merge
# 7a6b5c4 HEAD@{2}: checkout: moving from feature to main
# a1b2c3d HEAD@{3}: commit: feat: scoring engine
# ...

# Reflog for a specific branch
git reflog main
```

### Where reflog data lives

```bash
# HEAD's reflog
cat .git/logs/HEAD

# Branch reflogs
cat .git/logs/refs/heads/main
```

Each line records: old SHA, new SHA, who, when, and what operation.

### Recovery with the reflog

The reflog is the recovery tool for accidental resets, deleted branches, and botched
rebases:

```bash
# Scenario: you accidentally ran git reset --hard HEAD~3
# Three commits are now unreachable from any branch

# The reflog still has them
git reflog
# <sha> HEAD@{0}: reset: moving to HEAD~3
# <sha> HEAD@{1}: commit: the commit you want back
# <sha> HEAD@{2}: commit: another lost commit
# ...

# Recover by creating a branch at the old position
git branch recovery e5f6a7b

# Or reset back to where you were
git reset --hard e5f6a7b
```

### Reflog expiration

Reflog entries are not permanent:

- Reachable entries (pointed to by some branch): expire after 90 days
- Unreachable entries (orphaned by reset/rebase): expire after 30 days

After expiration, `git gc` can collect the unreachable objects. Until then, they survive
in the object store even if no branch points to them.

```bash
# Force immediate reflog expiration (dangerous - removes safety net)
git reflog expire --expire=now --all
git gc --prune=now
# Now orphaned objects are truly gone
```

> **AGENTIC GROUNDING:** When an agent's git operation produces unexpected results -
> a lost commit, a detached HEAD, a botched rebase - the reflog is the diagnostic tool.
> `git reflog` shows exactly what happened, in order, with timestamps. Before resorting
> to destructive recovery, always check the reflog. The 30/90-day expiration window
> means you have time.

---

## 9. Plumbing vs Porcelain

**Estimated time: 10 minutes**

Git's commands are divided into two categories by design:

**Porcelain** - user-facing commands with human-friendly output:

```bash
git status       # formatted status with colors and hints
git log          # formatted history
git add          # stage files
git commit       # create a commit
git push         # upload to remote
git merge        # merge branches
git checkout     # switch branches or restore files
```

**Plumbing** - machine-parseable commands for programmatic use:

```bash
git hash-object  # compute SHA and optionally store
git cat-file     # inspect object type, content, or size
git ls-tree      # list tree contents
git write-tree   # create tree from index
git commit-tree  # create commit from tree
git update-ref   # update a ref
git rev-parse    # resolve names to SHAs
git ls-files     # show index contents
git diff-tree    # compare two trees
git for-each-ref # iterate over refs
```

### Why the project uses plumbing

The Makefile uses plumbing commands because it needs:

1. **Deterministic output** - `git write-tree` always outputs exactly one SHA. `git
   status` outputs variable-length human text.
2. **Machine parseability** - `git rev-parse HEAD` outputs a SHA that can be stored in
   a variable. `git log` outputs formatted text that must be parsed.
3. **Precise semantics** - `git write-tree` creates a tree from the index. There is no
   porcelain command that does exactly this without also creating a commit.

```makefile
# Plumbing in the Makefile:
TREE := $(shell git write-tree 2>/dev/null | cut -c1-8)
SHA := $(shell git rev-parse --short HEAD)

# Delta detection in the POLECAT wrapper:
PRE_HEAD=$$(git rev-parse HEAD)
PRE_DIFF=$$(git diff --stat)
# ... run polecat ...
POST_HEAD=$$(git rev-parse HEAD)
POST_DIFF=$$(git diff --stat)
```

Porcelain is for humans at the terminal. Plumbing is for scripts, Makefiles, and agents
that need to operate on git state programmatically.

> **AGENTIC GROUNDING:** Agents typically use porcelain commands because those are what
> appears in tutorials and documentation. But when an agent's porcelain operation fails
> or produces unexpected results, plumbing commands are the diagnostic layer. `git status`
> says "nothing to commit" but something feels wrong? `git ls-files --stage` shows exactly
> what is in the index. `git cat-file -p HEAD` shows exactly what tree the last commit
> points to. Plumbing does not interpret - it reports.

---

## Challenge: Build a Commit by Hand

**Estimated time: 20 minutes**

**Goal:** Create a complete git commit using only plumbing commands. No `git add`, no
`git commit`.

Set up a scratch repository:

```bash
mkdir /tmp/git-plumbing-lab && cd /tmp/git-plumbing-lab
git init
```

Steps:

1. Create a blob from a string:

```bash
blob_sha=$(echo "hello from plumbing" | git hash-object -w --stdin)
printf "blob SHA: %s\n" "$blob_sha"
git cat-file -t "$blob_sha"
# blob
git cat-file -p "$blob_sha"
# hello from plumbing
```

2. Create a tree containing that blob:

```bash
# mktree reads entries from stdin in ls-tree format
tree_sha=$(printf "100644 blob %s\tgreeting.txt\n" "$blob_sha" | git mktree)
printf "tree SHA: %s\n" "$tree_sha"
git ls-tree "$tree_sha"
# 100644 blob <sha>    greeting.txt
```

3. Create a commit pointing to that tree:

```bash
commit_sha=$(echo "feat: first commit via plumbing" | git commit-tree "$tree_sha")
printf "commit SHA: %s\n" "$commit_sha"
git cat-file -p "$commit_sha"
# tree <sha>
# author ...
#
# feat: first commit via plumbing
```

4. Point a branch at the commit:

```bash
git update-ref refs/heads/main "$commit_sha"
# If HEAD is symbolic ref to main, it now resolves to this commit
```

5. Verify with porcelain:

```bash
git log --oneline
# <sha> feat: first commit via plumbing
git show
# Shows the commit with the greeting.txt file
```

**Verification:** You should see a valid commit with a single file `greeting.txt`
containing "hello from plumbing". You created this without ever touching `git add` or
`git commit`.

**Extension:** Add a second file to the tree. Create a second commit with the first as
its parent (`git commit-tree "$tree2" -p "$commit_sha"`). Verify the log shows two
commits.

---

## Challenge: Object Archaeology

**Estimated time: 15 minutes**

**Goal:** Trace through the object graph of a real commit in this repository.

1. Pick a commit from the project's history:

```bash
# Get a commit SHA from the log
commit=$(git log --oneline -10 | tail -1 | cut -d' ' -f1)
printf "Starting from commit: %s\n" "$commit"
```

2. Inspect the commit object:

```bash
git cat-file -p "$commit"
# Note the tree SHA
```

3. Inspect the tree:

```bash
tree=$(git cat-file -p "$commit" | head -1 | cut -d' ' -f2)
git ls-tree "$tree"
# Note a subdirectory (type tree) and a regular file (type blob)
```

4. Follow a subtree:

```bash
# Pick a tree entry (e.g., lib/)
subtree=$(git ls-tree "$tree" | grep "^040000" | head -1 | awk '{print $3}')
git ls-tree "$subtree"
```

5. Read a blob:

```bash
# Pick a blob entry from the subtree
blob=$(git ls-tree "$subtree" | grep "^100644" | head -1 | awk '{print $3}')
git cat-file -p "$blob" | head -20
```

**Draw the object graph on paper:** commit -> tree -> subtree -> blob. At each level,
note the SHA and what the object contains. This is the physical structure beneath every
`git log` and `git show` you have ever run.

---

## Challenge: The Index Dissected

**Estimated time: 15 minutes**

**Goal:** Observe the index at each stage of a multi-file staging operation.

Set up:

```bash
mkdir /tmp/index-lab && cd /tmp/index-lab
git init
```

1. Create three files:

```bash
echo "alpha content" > alpha.txt
echo "beta content" > beta.txt
echo "gamma content" > gamma.txt
```

2. Stage them one at a time and observe:

```bash
# Nothing staged yet
git ls-files --stage
# (empty)

git add alpha.txt
git ls-files --stage
# 100644 <sha1> 0    alpha.txt

git add gamma.txt
git ls-files --stage
# 100644 <sha1> 0    alpha.txt
# 100644 <sha3> 0    gamma.txt

git add beta.txt
git ls-files --stage
# 100644 <sha1> 0    alpha.txt
# 100644 <sha2> 0    beta.txt
# 100644 <sha3> 0    gamma.txt
```

Note: the index is always sorted alphabetically, regardless of staging order.

3. Modify a file without staging and show the three-way state:

```bash
echo "modified alpha" > alpha.txt

git diff               # working tree vs index (shows alpha change)
git diff --cached      # index vs HEAD (shows all three files as new)
git diff HEAD          # working tree vs HEAD (shows all three, alpha with new content)
```

4. Stage the modification:

```bash
git add alpha.txt
git ls-files --stage
# 100644 <sha-new> 0    alpha.txt    <- SHA changed!
# 100644 <sha2>    0    beta.txt
# 100644 <sha3>    0    gamma.txt
```

**Verification:** The blob SHA for alpha.txt changed when you staged the new content. The
blob SHAs for beta.txt and gamma.txt did not. This is content addressing in action.

---

## Challenge: Reflog Rescue

**Estimated time: 15 minutes**

**Goal:** Lose commits deliberately, then recover them using the reflog.

Set up:

```bash
mkdir /tmp/reflog-lab && cd /tmp/reflog-lab
git init
echo "base" > file.txt && git add . && git commit -m "initial"
```

1. Create three commits:

```bash
echo "commit 1" >> file.txt && git add . && git commit -m "first"
echo "commit 2" >> file.txt && git add . && git commit -m "second"
echo "commit 3" >> file.txt && git add . && git commit -m "third"
git log --oneline
# Shows 4 commits
```

2. Lose the commits:

```bash
git reset --hard HEAD~3
git log --oneline
# Shows only "initial"
cat file.txt
# base
```

The three commits are gone from the branch. But they still exist as objects.

3. Find them in the reflog:

```bash
git reflog
# <sha> HEAD@{0}: reset: moving to HEAD~3
# <sha> HEAD@{1}: commit: third
# <sha> HEAD@{2}: commit: second
# <sha> HEAD@{3}: commit: first
# <sha> HEAD@{4}: commit (initial): initial
```

4. Recover:

```bash
# Option A: create a branch at the lost commit
git branch recovered HEAD@{1}
git log --oneline recovered
# Shows all 4 commits

# Option B: reset back to where you were
git reset --hard HEAD@{1}
git log --oneline
# Shows all 4 commits
```

5. Observe orphan behavior:

```bash
# Create an orphan branch (no parent, fresh history)
git checkout --orphan clean-slate
git rm -rf .
echo "fresh start" > file.txt && git add . && git commit -m "orphan start"
git log --oneline --all
# Shows commits on both branches - the DAG has two disconnected components
```

**Verification:** The reflog recorded every ref change. The "lost" commits survived in
the object store because reflog entries kept them reachable. Without the reflog, `git gc`
would eventually collect them.

---

## Challenge: Reproduce the Makefile Identity

**Estimated time: 10 minutes**

**Goal:** Manually compute what the Makefile's `TREE` and `SHA` variables produce.

In the project repository:

```bash
# What the Makefile computes:
# TREE := $(shell git write-tree 2>/dev/null | cut -c1-8)
# SHA := $(shell git rev-parse --short HEAD)

# Step 1: Reproduce TREE
tree_full=$(git write-tree 2>/dev/null)
tree_short=$(printf "%.8s" "$tree_full")
printf "TREE_FULL: %s\n" "$tree_full"
printf "TREE (first 8): %s\n" "$tree_short"

# Step 2: Reproduce SHA
sha=$(git rev-parse --short HEAD)
printf "SHA: %s\n" "$sha"

# Step 3: Understand the difference
# Modify a file and stage it
echo "# test" >> AGENTS.md
git add AGENTS.md

# TREE changes (staged content changed)
tree_after=$(git write-tree 2>/dev/null | cut -c1-8)
printf "TREE after staging: %s\n" "$tree_after"

# SHA does NOT change (no new commit yet)
sha_after=$(git rev-parse --short HEAD)
printf "SHA after staging: %s\n" "$sha_after"

# Clean up
git checkout -- AGENTS.md
```

**Key insight:** The tree hash changes with staged content (before commit). The commit
SHA only changes after a commit is created. The Makefile uses the tree hash because it
represents "what is about to be committed" - the current build identity.

---

## Challenge: Write a git-verify Script

**Estimated time: 20 minutes**

**Goal:** Build a verification tool that audits the difference between two commits using
only plumbing commands.

```bash
#!/bin/bash
# git-verify: compare two commits at the object level
# Usage: ./git-verify.sh <old-commit> <new-commit>

old="${1:?Usage: $0 <old-commit> <new-commit>}"
new="${2:?Usage: $0 <old-commit> <new-commit>}"

# Resolve to full SHAs
old_sha=$(git rev-parse --verify "$old" 2>/dev/null) || {
  printf "Error: '%s' is not a valid commit\n" "$old" >&2; exit 1
}
new_sha=$(git rev-parse --verify "$new" 2>/dev/null) || {
  printf "Error: '%s' is not a valid commit\n" "$new" >&2; exit 1
}

# Get tree SHAs
old_tree=$(git cat-file -p "$old_sha" | sed -n 's/^tree //p')
new_tree=$(git cat-file -p "$new_sha" | sed -n 's/^tree //p')

printf "=== Commit Comparison ===\n\n"
printf "Old: %s\n" "$old_sha"
printf "New: %s\n" "$new_sha"
printf "Old tree: %s\n" "$old_tree"
printf "New tree: %s\n" "$new_tree"
printf "\n"

# Files changed (using diff-tree, a plumbing command)
printf "=== Changed Files ===\n"
git diff-tree -r --no-commit-id --name-status "$old_sha" "$new_sha"
printf "\n"

# Blob-level changes (what actually changed in the object store)
printf "=== Blob Changes ===\n"
git diff-tree -r --no-commit-id "$old_sha" "$new_sha" | while read old_mode new_mode old_blob new_blob status path; do
  printf "%s %s\n" "$status" "$path"
  printf "  old blob: %s  new blob: %s\n" "$old_blob" "$new_blob"
  if [ "$status" = "M" ]; then
    # Show size change
    old_size=$(git cat-file -s "$old_blob" 2>/dev/null || printf "0")
    new_size=$(git cat-file -s "$new_blob" 2>/dev/null || printf "0")
    printf "  size: %s -> %s bytes\n" "$old_size" "$new_size"
  fi
done
printf "\n"

# Commit metadata
printf "=== Commit Metadata ===\n"
printf "Author: %s\n" "$(git cat-file -p "$new_sha" | sed -n 's/^author //p')"
printf "Message: %s\n" "$(git cat-file -p "$new_sha" | sed -n '/^$/,$ p' | tail -n +2)"
```

Make it executable and test it:

```bash
chmod +x git-verify.sh

# Compare the two most recent commits
./git-verify.sh HEAD~1 HEAD

# Compare across a range
./git-verify.sh HEAD~5 HEAD
```

**Extension ideas:**

- Add a `--tree-only` flag that shows the full recursive tree diff
- Add detection of unexpected file changes (files outside an expected directory)
- Add blob content comparison for specific files (useful for verifying agent changes to
  config files)
- Output YAML for machine consumption

This is the kind of verification tool that sits between the Operator and agent commits.
Instead of trusting `git show` (porcelain that summarizes), you verify at the object level
(plumbing that reports).

---

## Summary

| Concept | What it is | Why it matters |
|---------|-----------|---------------|
| Content addressing | SHA-1 hash of content = object name | Deduplication, integrity, immutability |
| Blob | File content (no name, no permissions) | The atomic unit of storage |
| Tree | Directory listing of (mode, type, sha, name) | Captures project structure |
| Commit | Tree + parent(s) + metadata + message | The snapshot, not the diff |
| DAG | Directed acyclic graph of commits | Structure beneath merge, rebase, cherry-pick |
| Refs | Files containing SHAs | Human names for machine addresses |
| HEAD | Symbolic ref to current branch | "Where am I?" |
| Index | Binary file = the next commit's tree | The staging area between working tree and commit |
| Reflog | Log of every ref change | Safety net for recovery |
| Plumbing | Machine-parseable commands | Diagnostic and programmatic access |
| Porcelain | Human-friendly commands | Daily use, not verification |

The core principle: **git is a content-addressable filesystem with a version history.**
Everything else - branches, merges, rebases, remotes - is a layer of convenience on top
of four object types and a handful of pointer files. When the convenience layer produces
confusing results, drop to the object level.

> **HISTORY:** SHA-1 was chosen for content addressing, not cryptographic security. When
> SHA-1 collision attacks became practical in 2017 (Google's SHAttered project produced
> two different PDFs with the same SHA-1), git added hardened SHA-1 detection and began
> transitioning to SHA-256. The transition is ongoing - git can now operate in SHA-256
> mode (`git init --object-format=sha256`), but interoperability with SHA-1 repositories
> remains the default.

---

## What to Read Next

**[Step 8: Process Observation](/bootcamp/08-process-observation/)** - now that you can verify
git state at the object level, learn how to observe processes at the system call level.
`strace` shows you every system call a process makes - every `open()`, `read()`,
`write()`, `stat()`. When `git commit` behaves unexpectedly, you can `strace git commit`
to see exactly what files it opens, what it writes to `.git/objects/`, and what refs it
updates. Process observation is the next verification layer down from object inspection.

The dependency chain: the filesystem (Step 3) stores git objects. Git's object model
(this step) organizes those objects into a version history. Process observation (Step 8)
lets you watch the system calls that create and manipulate those objects in real time.

---

## References

- Chacon, S. & Straub, B. *Pro Git* (2nd ed., 2014) - Chapter 10 (Git Internals) covers
  the object model, packfiles, and transfer protocols. Free at https://git-scm.com/book
- Torvalds, L. "Git - A Stupid Content Tracker" - the original README from April 2005.
  Still available in git's own git repository.
- `man gitrepository-layout` - documents the `.git/` directory structure.
- `man git-cat-file`, `man git-ls-tree`, `man git-write-tree`, `man git-commit-tree`,
  `man git-update-ref`, `man git-rev-parse` - individual plumbing command references.
- `man gitglossary` - definitions of git terminology (blob, tree, commit, ref, index, DAG).
- The SHAttered attack: https://shattered.io - why git is transitioning from SHA-1 to
  SHA-256.
