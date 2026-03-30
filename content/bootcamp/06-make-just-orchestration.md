+++
title = "Make and Just as Orchestrators"
date = "2026-03-10"
description = "DAG execution and recipe running - how shell recipes become deterministic pipelines."
tags = ["make", "just", "orchestration", "build-systems", "bootcamp"]
step = 6
tier = 1
estimate = "4-5 hours"
bootcamp = 1
+++

Step 6 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Steps 1-5 (process model, shell language, filesystem, text pipeline, Python CLI tools)
**Key dependency:** understanding shell recipes (Step 2), file timestamps (Step 3), and the shell-Python boundary (Step 5)

---

## Overview

Make is not a build tool. Make is a DAG executor that happens to be used for building
software. Just is not make. Just is a recipe runner that deliberately dropped the DAG.

This distinction is fundamental. Make answers: "what needs to be done, given what has
already been done?" Just answers: "run this named recipe." Make reasons about state
(file timestamps). Just does not.

This project uses both. The Makefile with its three include files (`mk/polecats.mk`,
`mk/darkcat.mk`, `mk/gauntlet.mk`) orchestrates the entire polecat pipeline - 26
build tasks with explicit dependencies, adversarial review dispatch, and the full
verification gauntlet. The research subprojects use justfiles for dev commands that
have no dependency relationships.

Understanding both is understanding the orchestration layer of agentic engineering.
The Makefile IS the nervous system of the build pipeline. Every agent dispatch, every
gate check, every verification step flows through it. If you cannot read the Makefile,
you cannot verify the pipeline.

---

## 1. Make is a DAG Executor (~45 min)

### The Mental Model

Make's fundamental model is three concepts:

1. **Targets** - things you want to produce (usually files)
2. **Prerequisites** - things the target depends on (usually other files)
3. **Recipes** - shell commands that produce the target from the prerequisites

```make
target: prerequisite1 prerequisite2
	recipe-command-1
	recipe-command-2
```

Make's decision algorithm is simple: if the target does not exist, or if any
prerequisite is newer than the target, run the recipe. That is it. That is the entire
model. Everything else is convenience built on top of this.

This makes make a timestamp-based DAG executor. The targets and prerequisites form a
directed acyclic graph. Make walks the graph, checks timestamps, and runs recipes
where needed. It does not know about C, Java, TypeScript, or anything else. It knows
about files and timestamps.

```
  target
   / \
  v   v
 p1    p2      <-- if mtime(p1) > mtime(target), rebuild target
       |
       v
      p3        <-- if mtime(p3) > mtime(p2), rebuild p2 first, then target
```

When you understand this, you understand why the project's `.done/` directory works.
`make 07` checks if `.done/07` exists and is newer than its prerequisites (`.done/06`
and `plans/07-bout-validation.md`). If `.done/07` does not exist, or if either
prerequisite is newer, make runs the recipe. The recipe calls the POLECAT wrapper, runs
the gate, and touches `.done/07` to record completion.

File existence as completion state. Timestamps as ordering. The simplest possible
state machine.

> **HISTORY:** Stuart Feldman wrote make in 1976 at Bell Labs. He needed to automate
> building programs after editing source files. The insight was that the dependency
> relationships between files form a graph, and the build process is a topological
> sort of that graph filtered by timestamps.
>
> He chose tabs for recipe indentation because he was using lex and yacc (both brand
> new at the time) and did not want to write a full parser. The tab in column 1 was a
> lexer hack - trivial to detect. By the time he realized it was a terrible user
> interface decision, "there were already about a dozen users, so it was too late."
> That tab requirement persists to this day, 50 years later.

### Try It

Create a minimal Makefile:

```make
# Save as Makefile (use actual tab characters for indentation)
greeting.txt: name.txt
	echo "Hello, $$(cat name.txt)" > greeting.txt

name.txt:
	echo "World" > name.txt
```

```bash
make greeting.txt      # builds name.txt first (prerequisite), then greeting.txt
cat greeting.txt       # "Hello, World"
make greeting.txt      # "make: 'greeting.txt' is up to date." - nothing to do
touch name.txt         # update timestamp on prerequisite
make greeting.txt      # rebuilds - name.txt is now newer than greeting.txt
```

That "nothing to do" message is make's DAG at work. It checked the timestamps, found
that greeting.txt is newer than name.txt, and decided no work was needed. Touch
name.txt (updating its timestamp without changing its contents) and make rebuilds -
because it reasons about timestamps, not content.

> **AGENTIC GROUNDING:** This is exactly how the project's pipeline avoids re-running
> completed tasks. When `make 13` is invoked, make checks whether `.done/13` exists
> and is newer than `.done/09`, `.done/10`, and `plans/13-bout-persistence-credits.md`.
> If the plan file is edited (timestamp updated), the task re-runs. If a prerequisite
> task is re-run (its `.done/` marker is touched with a new timestamp), downstream
> tasks re-run. The DAG handles cascade invalidation automatically.

---

## 2. Targets, Prerequisites, Recipes in Detail (~30 min)

### Recipe Execution Model

Each line of a recipe runs in a separate shell by default. This is a critical detail
that catches everyone:

```make
# BROKEN - cd only affects the first line's shell
broken:
	cd subdir
	ls          # runs in the ORIGINAL directory, not subdir

# FIXED - use && to chain in a single shell
fixed:
	cd subdir && ls

# ALSO FIXED - use .ONESHELL (GNU make 3.82+)
```

The project's Makefile sets `.ONESHELL` at the top, which means all recipe lines run
in a single shell invocation. This is why the POLECAT wrapper (which spans many lines)
works as a coherent script.

### Recipe Prefixes

Three prefixes modify recipe line behavior:

```make
target:
	normal-command          # echoed to stdout before execution
	@silent-command         # NOT echoed (suppressed output)
	-failing-command        # error is IGNORED (make continues)
```

- `@` suppresses the command echo. Without it, make prints each command before
  executing it. The project uses `@` on most lines to keep output clean.
- `-` ignores the exit code. Normally, a non-zero exit stops make. The `-` prefix
  says "continue even if this fails." Use sparingly - ignoring errors silently is
  usually a mistake.

### .PHONY

A target is normally expected to be a file. If a file with that name exists, and it
has no prerequisites, make says "up to date" and does nothing. `.PHONY` tells make
"this target is not a file - always run its recipe."

```make
.PHONY: clean test status

clean:
	rm -rf build/

test:
	pnpm run test

status:
	@echo "Current status..."
```

Without `.PHONY: clean`, if someone creates a file called `clean` in the directory,
`make clean` would say "up to date" and do nothing. Declaring it phony prevents this.

The project declares all its targets as phony (line 137-140 of the root Makefile)
because the actual state is tracked via `.done/` files, not the target names
themselves. The numbered targets (01, 02, ..., 26) are not files - they are entry
points that trigger recipes which create `.done/XX` files.

---

## 3. Variables and the $$ Escape (~30 min)

### Variable Flavors

Make has four assignment operators:

```make
# Simple expansion - evaluated ONCE at assignment time
CC := gcc
FLAGS := -Wall -O2

# Recursive expansion - evaluated EVERY TIME the variable is used
SOURCES = $(wildcard src/*.c)    # re-scanned each use

# Conditional - only sets if not already defined
CC ?= gcc                       # useful for overridable defaults

# Append
FLAGS += -Werror                 # adds to existing value
```

The difference between `:=` and `=` matters:

```make
A = $(B)       # recursive: A will contain whatever B is when A is USED
B = hello

# $(A) evaluates to "hello" even though B was defined AFTER A

C := $(D)      # simple: C is evaluated NOW - D is empty, so C is empty
D := world

# $(C) is empty because D had no value when C was assigned
```

The project uses `:=` for most variables (simple expansion, predictable behavior) and
`?=` for overridable defaults like `TIER ?= full` and `SYNTH_HARNESS ?= claude`.

### The $$ Escape Rule

This is the single most confusing aspect of make for shell programmers. Make processes
`$` characters before the shell sees the recipe. To get a literal `$` in the shell
command, you must write `$$`.

```make
# What you WRITE in the Makefile:
show-pid:
	echo "My PID is $$$$"
	for f in *.txt; do echo "$$f"; done

# What the SHELL SEES (after make processes $):
# echo "My PID is $$"          # shell expands $$ to its PID
# for f in *.txt; do echo "$f"; done  # shell expands $f
```

The processing chain: `$$$$` -> make consumes pairs -> `$$` -> shell expands -> PID.

Look at the project's POLECAT wrapper:

```make
define POLECAT
	@TASK=$$(basename $(1) .md); \
	echo "polecat $$TASK - streaming to $(LOGS)/$$TASK.log"; \
	PRE_HEAD=$$(git rev-parse HEAD); \
```

Here, `$(1)` and `$(LOGS)` are make variables (expanded by make before the shell
runs). `$$TASK`, `$$EXIT_CODE`, `$$?` are shell variables (the first `$` is consumed
by make, the second reaches the shell as `$TASK`, `$EXIT_CODE`, `$?`).

The rule: **one `$` for make, two `$$` for shell.** If you see `$$` in a recipe, it
is a shell variable. If you see `$()` or `${}` with no doubling, it is a make variable.

### Try It

```make
# Save as Makefile
escape-test:
	@MYVAR="hello from shell"; \
	echo "make var SHELL = $(SHELL)"; \
	echo "shell var MYVAR = $$MYVAR"; \
	echo "shell PID = $$$$"; \
	echo "exit code of last command = $$?"
```

```bash
make escape-test
# make var SHELL = /bin/bash       (make expanded $(SHELL))
# shell var MYVAR = hello from shell  (make passed $MYVAR to shell)
# shell PID = 12345                (make passed $$ to shell, shell expanded to PID)
# exit code of last command = 0    (make passed $? to shell)
```

> **AGENTIC GROUNDING:** Agents generate Makefiles. When they do, the `$$` escaping
> is one of the most common failure points. A recipe that uses `$HOME` instead of
> `$$HOME` will expand to nothing (make looks for a variable called `H` followed by
> literal `OME`). The symptom is a silent empty string where a path should be. If you
> understand the two-stage expansion model (make first, then shell), you can spot
> these bugs instantly in generated Makefiles.

---

## 4. Pattern Rules and Automatic Variables (~30 min)

### Pattern Rules

Pattern rules use `%` as a wildcard to create implicit rules:

```make
# Any .o file depends on the matching .c file
%.o: %.c
	$(CC) -c $< -o $@

# Any .html file depends on the matching .md file
%.html: %.md
	pandoc $< -o $@
```

The `%` is called the stem - it matches any non-empty string, and the same string is
substituted in the prerequisite pattern. So `foo.o` matches the pattern `%.o` with
stem `foo`, and the prerequisite becomes `foo.c`.

### Automatic Variables

Inside recipes, make provides automatic variables that refer to the current rule:

| Variable | Meaning | Example (for `foo.o: foo.c bar.h`) |
|----------|---------|-------------------------------------|
| `$@` | The target | `foo.o` |
| `$<` | The first prerequisite | `foo.c` |
| `$^` | All prerequisites (deduped) | `foo.c bar.h` |
| `$+` | All prerequisites (with duplicates) | `foo.c bar.h` |
| `$*` | The stem (what `%` matched) | `foo` |
| `$?` | Prerequisites newer than target | depends on timestamps |

```make
# Common pattern: compile C to object files
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@
	#                   ^     ^
	#                   |     +-- target (the .o file)
	#                   +-- first prereq (the .c file)
```

The project's Makefile uses explicit targets rather than pattern rules. The 26 polecat
tasks are individually declared because each has unique dependencies. Pattern rules
shine when you have uniform transformations (every .c becomes a .o the same way). The
polecat tasks are not uniform - task 13 depends on both `.done/09` and `.done/10`
(branch convergence), while task 07 depends only on `.done/06`.

### Text Functions

Make has built-in functions for text manipulation:

```make
SOURCES := src/main.c src/util.c src/parse.c
OBJECTS := $(patsubst %.c,%.o,$(SOURCES))
# OBJECTS = src/main.o src/util.o src/parse.o

HEADERS := $(wildcard include/*.h)
# Expands to all .h files in include/

# Shell command capture
GIT_SHA := $(shell git rev-parse --short HEAD)

# Iteration
DIRS := lib test docs
ALL_FILES := $(foreach dir,$(DIRS),$(wildcard $(dir)/*))
```

The project uses `$(shell ...)` for capturing git state:

```make
TREE := $(shell git write-tree 2>/dev/null | cut -c1-8)
TREE_FULL := $(shell git write-tree 2>/dev/null)
SHA := $(shell git rev-parse --short HEAD)
```

These execute at Makefile parse time (when make reads the file), not at recipe
execution time. The tree hash and SHA are computed once and used across all targets
in that invocation.

---

## 5. Multi-line Recipes with define/endef (~30 min)

### Canned Recipes

For complex multi-line recipes that are reused across targets, make provides
`define/endef` blocks with `$(call ...)`:

```make
define greet
	@echo "Hello, $(1)"
	@echo "Today is $$(date)"
endef

hello-world:
	$(call greet,World)

hello-make:
	$(call greet,Make)
```

`$(1)`, `$(2)`, etc. are positional arguments passed via `$(call ...)`. This is make's
equivalent of a function definition.

### The POLECAT Wrapper - A Deep Read

The project's POLECAT wrapper is the most important `define/endef` block in the
codebase. It is worth reading line by line:

```make
define POLECAT
	@TASK=$$(basename $(1) .md); \
	echo "polecat $$TASK - streaming to $(LOGS)/$$TASK.log"; \
	PRE_HEAD=$$(git rev-parse HEAD); \
	PRE_DIFF=$$(git diff --stat); \
	PRE_UNTRACKED=$$(git ls-files --others --exclude-standard | sort); \
	timeout $(POLECAT_TIMEOUT) claude -p "$$(cat $(1))" \
		--dangerously-skip-permissions \
		2>&1 | tee $(LOGS)/$$TASK.log; \
	EXIT_CODE=$$?; \
	if [ $$EXIT_CODE -eq 124 ]; then \
		echo "ERROR: polecat $$TASK timed out after $(POLECAT_TIMEOUT)s"; exit 1; \
	fi; \
	if [ $$EXIT_CODE -ne 0 ]; then \
		echo "ERROR: polecat $$TASK exited with code $$EXIT_CODE"; exit 1; \
	fi; \
	POST_HEAD=$$(git rev-parse HEAD); \
	POST_DIFF=$$(git diff --stat); \
	POST_UNTRACKED=$$(git ls-files --others --exclude-standard | sort); \
	if [ "$$PRE_HEAD" = "$$POST_HEAD" ] \
		&& [ "$$PRE_DIFF" = "$$POST_DIFF" ] \
		&& [ "$$PRE_UNTRACKED" = "$$POST_UNTRACKED" ]; then \
		echo "ERROR: polecat $$TASK produced no delta - noop detected"; exit 1; \
	fi
endef
```

What this does, decomposed:

1. **Extract task name**: `$$(basename $(1) .md)` - make expands `$(1)` to the plan
   file path, then the shell runs `basename` to strip the directory and `.md` extension.

2. **Capture pre-state**: Three git commands record HEAD commit, diff stats, and
   untracked files before the agent runs. This is the "before snapshot."

3. **Execute with timeout**: `timeout $(POLECAT_TIMEOUT)` wraps the claude invocation
   with a hard kill timer (300 seconds by default). The `timeout` command returns exit
   code 124 on timeout.

4. **Stream and capture output**: `2>&1 | tee` merges stderr into stdout, then tee
   splits the stream to both the terminal (live visibility) and a log file (durability).

5. **Check exit code**: Exit code 124 means timeout. Any non-zero means failure. Both
   are fatal.

6. **Capture post-state**: Same three git commands after the agent runs.

7. **Delta detection**: Compare pre and post snapshots. If HEAD, diff stats, AND
   untracked files are all identical, the agent did nothing. This is a noop guard -
   an agent that runs successfully but produces no changes is a failure, not a success.

This wrapper embodies several engineering principles: observable (streaming + logging),
bounded (timeout), verified (exit code + delta detection), and deterministic (same
inputs produce same detection logic regardless of what the agent does internally).

Each polecat task calls it identically:

```make
07: $(DONE)/06 plans/07-bout-validation.md
	$(call POLECAT,plans/07-bout-validation.md)
	$(GATE)
	@touch $(DONE)/07
	@echo "07-bout-validation complete. Review, then: make 08"
```

Three steps: run the agent (POLECAT), verify the result (GATE), record completion
(touch). Always in that order. Never skipped.

> **AGENTIC GROUNDING:** The POLECAT wrapper is a masterclass in agent supervision.
> It answers every question an operator needs: Did the agent time out? Did it crash?
> Did it actually change anything? Can I see what it did? The delta detection (comparing
> git state before and after) is particularly important - it catches the case where an
> agent reports success but makes no actual changes, a failure mode that passes every
> other check.

---

## 6. The Include Mechanism (~15 min)

### Textual Inclusion

Make's `include` directive is textual inclusion, like C's `#include`:

```make
# Root Makefile
DONE := .done
GATE := pnpm run typecheck && pnpm run lint && pnpm run test:unit

include mk/polecats.mk     # 26 build tasks
include mk/darkcat.mk      # adversarial review pipeline
include mk/gauntlet.mk     # full verification pipeline
```

After inclusion, make sees one large Makefile. Variables defined in the parent are
available in included files. Variables defined in included files are available in the
parent and in subsequently included files.

The project's four-file structure:

| File | Purpose | Targets |
|------|---------|---------|
| `Makefile` | Shared variables, POLECAT wrapper, meta targets | `all`, `status`, `graph`, `clean` |
| `mk/polecats.mk` | 26 build tasks with dependency graph | `01` through `26` |
| `mk/darkcat.mk` | Adversarial review dispatch | `darkcat`, `darkcat-openai`, `darkcat-gemini`, `darkcat-all`, `darkcat-synth` |
| `mk/gauntlet.mk` | Full verification pipeline | `gauntlet`, `gauntlet-gate`, `gauntlet-pitkeel` |

This split is organizational, not functional. All four files share the same variable
namespace. `mk/polecats.mk` uses `$(DONE)`, `$(GATE)`, and `$(call POLECAT,...)` - all
defined in the root Makefile.

### Recursive Make vs Include

There is an important distinction between `include mk/polecats.mk` (textual inclusion)
and `$(MAKE) -C subdir` (recursive make). The project uses `$(MAKE)` in a few places:

```make
# From mk/darkcat.mk
darkcat-all:
	@$(MAKE) -j2 darkcat darkcat-openai

# From mk/gauntlet.mk
gauntlet:
	@$(MAKE) gauntlet-gate
	@$(MAKE) darkcat-all
	@$(MAKE) gauntlet-pitkeel
```

Here, `$(MAKE)` re-invokes make as a subprocess. This is done deliberately to get
independent parallel execution (the `-j2` in `darkcat-all`) or sequential pipeline
stages (the gauntlet steps). Each `$(MAKE)` invocation is a separate make process with
its own job control.

> **HISTORY:** Peter Miller's 1997 paper "Recursive Make Considered Harmful" argued
> that recursive make (calling make from make in subdirectories) breaks dependency
> tracking because each make process has only a partial view of the dependency graph.
> His proposed alternative was a single top-level Makefile with includes - which is
> exactly what this project does. The occasional `$(MAKE)` calls in the project are
> not the recursive-make anti-pattern; they are explicit subprocess invocations for
> parallelism or sequencing, with no cross-process dependencies that could break.

---

## 7. Dependency Graph and Execution (~20 min)

### Parallel Execution

Make can execute independent targets in parallel with the `-j` flag:

```bash
make -j4           # up to 4 recipes running simultaneously
make -j            # unlimited parallelism (dangerous)
make -j1           # serial execution (default)
```

Make determines which targets are independent by examining the dependency graph. If
target A and target B share no prerequisite chain, they can run in parallel.

In the project's pipeline, tasks 06-09 (bout branch) and tasks 10-12 (credit branch)
are independent after task 05. With `make -j4 06 07 08 09 10 11 12`, make would
recognize that 06 and 10 can start in parallel (both depend only on `.done/05`), but
07 must wait for 06, 11 must wait for 10, etc.

### Diagnostic Flags

```bash
make -n target       # dry-run: print commands without executing
make -n 07           # shows exactly what would run for task 07

make --debug=v target  # verbose: shows dependency resolution
make --debug=v 13     # shows why make decides to rebuild or skip

make -p              # print the entire internal database (variables, rules, etc.)
make -p | grep -A2 '^07:'  # find the rule for target 07
```

`make -n` is indispensable. Before running any unfamiliar make target, run it with
`-n` first to see what it will do without doing it. This is the "verify before
execute" principle applied to the orchestration layer.

### The Project's Dependency Graph

The `make graph` target prints the full dependency tree:

```
01 scaffold
+-- 02 database
    +-- 03 clerk
    |   +-- 04 user-mirroring
    |   +-- 05 api-utils
    |       +-- 06 presets
    |       |   +-- 07 bout-validation
    |       |       +-- 08 bout-turn-loop
    |       |           +-- 09 bout-streaming
    |       |               +-- 13 bout-persistence+credits <-(+10)
    |       |                   +-- 14 useBout-hook
    |       |                       +-- 15 bout-viewer
    |       |                           +-- 16 arena-page
    |       +-- 10 credit-balance
    |       |   +-- 11 credit-preauth
    |       |       +-- 12 credit-catalog
    |       |           +-- 17 tier-config
    |       |               +-- 18 stripe-webhook
    |       |                   +-- 19 stripe-checkout
    |       +-- 20 reactions
    |       |   +-- 21 votes+leaderboard
    |       |       +-- 22 short-links
    |       +-- 23 agent-api
    |           +-- 24 agent-pages
    |   +-- 25 replay <-(15+22)
    |       +-- 26 deploy
```

Notice the convergence point at task 13: it depends on both `.done/09` (bout branch)
and `.done/10` (credit branch). And task 25 depends on both `.done/15` and `.done/22`
(two separate feature branches). These are diamond dependencies in the DAG - multiple
paths converging at a single target.

This structure is declared in `mk/polecats.mk`:

```make
# Task 13 depends on BOTH branches completing
13: $(DONE)/09 $(DONE)/10 plans/13-bout-persistence-credits.md
	$(call POLECAT,plans/13-bout-persistence-credits.md)
	$(GATE)
	@touch $(DONE)/13

# Task 25 depends on two unrelated feature branches
25: $(DONE)/15 $(DONE)/22 plans/25-replay-page.md
	$(call POLECAT,plans/25-replay-page.md)
	$(GATE)
	@touch $(DONE)/25
```

---

## 8. The GATE and Verification Pattern (~15 min)

The GATE variable stores the verification command:

```make
GATE := pnpm run typecheck && pnpm run lint && pnpm run test:unit 2>/dev/null
```

This is a shell command stored in a make variable. When `$(GATE)` appears in a recipe,
make expands it to the full shell command, and the shell executes it. The `&&` chaining
means typecheck must pass before lint runs, and lint must pass before tests run. Any
failure stops the chain and propagates as a non-zero exit code, which makes make
consider the recipe failed.

The pattern in every polecat task is:

```make
NN: $(DONE)/MM plans/NN-feature.md
	$(call POLECAT,plans/NN-feature.md)     # 1. Run the agent
	$(GATE)                                  # 2. Verify the result
	@touch $(DONE)/NN                        # 3. Record completion
```

Step 3 only executes if step 2 succeeds. Step 2 only executes if step 1 succeeds.
If the agent produces code that fails the gate, `.done/NN` is never created, and the
task remains "incomplete" in make's view. Re-running `make NN` will re-run the full
sequence from step 1.

This is the quality gate pattern: the gate is not optional, not bypassable from within
the recipe, and not a separate step that can be forgotten. It is structurally embedded
in the recipe between "do the work" and "mark it done."

> **AGENTIC GROUNDING:** The GATE pattern demonstrates a critical principle: the
> verification is not something the agent does to itself. The agent runs (POLECAT),
> then an external, independent check runs (GATE). The agent cannot skip the gate,
> cannot mark itself as done, cannot proceed to the next task. This separation between
> "execution" and "verification" is what makes the pipeline trustworthy. When reviewing
> agent-generated Makefiles, check whether the verification is embedded in the recipe
> (good) or left as a separate manual step (fragile).

---

## 9. Just: The Recipe Runner (~30 min)

### Why Just Exists

Just was created by Casey Rodarmor because he wanted a command runner without make's
complexity. The key decisions:

- **No dependency tracking** - recipes are independent, named commands
- **No timestamp checking** - every invocation runs the recipe
- **No tab sensitivity** - indentation is whitespace, not specifically tabs
- **Better argument handling** - `just deploy staging` passes "staging" as an argument
- **Built-in features** - dotenv loading, OS detection, interpreter choice

### Basic Syntax

```just
# A justfile (named 'justfile' in the directory)

# Comments above recipes become help text for --list
# Build the project
build:
    cargo build --release

# Run tests with optional filter
test filter="":
    cargo test {{filter}}

# Deploy to a specific environment
deploy env:
    ./scripts/deploy.sh {{env}}

# Recipe with a specific interpreter
analyze:
    #!/usr/bin/env python3
    import json
    data = json.load(open("metrics.json"))
    print(f"Total: {data['total']}")
```

```bash
just              # runs the default recipe (first one, or one named 'default')
just build        # runs the 'build' recipe
just test          # runs test with empty filter
just test auth    # runs test with filter="auth"
just deploy prod  # runs deploy with env="prod"
just --list       # shows all recipes with their comments
```

### Variables and Expressions

```just
# Variables
version := "1.0.0"
build_dir := "target/release"

# Environment variable with default
port := env("PORT", "8080")

# Backtick expressions (like make's $(shell ...))
git_sha := `git rev-parse --short HEAD`

# Conditional
os_flag := if os() == "linux" { "--flag-linux" } else { "--flag-mac" }

build:
    echo "Building {{version}} ({{git_sha}})"
```

### Dotenv Loading

```just
set dotenv-load := true

# Now all variables from .env are available as environment variables
start:
    echo "Starting on port $PORT"   # $PORT from .env
```

The project's research justfile uses this:

```just
set dotenv-load := true

export VIRTUAL_ENV := ""

_sandbox_url := env("AGENT_SANDBOX_URL", "")
default_url := if _sandbox_url == "" { "http://localhost:7600" } else { _sandbox_url }
```

### Multi-interpreter Recipes

One of just's strongest features - each recipe can specify its own interpreter:

```just
# Bash recipe
backup:
    #!/usr/bin/env bash
    set -euo pipefail
    timestamp=$(date +%Y%m%d)
    tar czf "backup-$timestamp.tar.gz" data/

# Python recipe
report:
    #!/usr/bin/env python3
    import csv, sys
    reader = csv.reader(open("data.csv"))
    total = sum(float(row[2]) for row in reader)
    print(f"Total: {total:.2f}")

# Node recipe
validate:
    #!/usr/bin/env node
    const schema = require('./schema.json');
    console.log('Schema valid:', !!schema);
```

This eliminates the need for wrapper scripts. The recipe IS the script.

### Real-World Example: The Project's Justfile

The `mac-mini-agent` justfile demonstrates just's strengths for dev commands:

```just
# List available commands
default:
    @just --list

# Start the listen server
listen:
    cd apps/listen && uv run python main.py

# Send a job to the listen server
send prompt url=default_url:
    cd apps/direct && uv run python main.py start {{url}} "{{prompt}}"

# Send a job from a local file
sendf file url=default_url:
    #!/usr/bin/env bash
    prompt="$(cat '{{file}}')"
    cd apps/direct && uv run python main.py start '{{url}}' "$prompt"
```

Note how `send` takes two arguments with a default for `url`. And `sendf` uses a bash
shebang because it needs a shell variable (`$prompt`) within the recipe. Just handles
both cases cleanly.

---

## 10. Make vs Just: When to Use Which (~15 min)

### Comparison Table

| Feature | Make | Just |
|---------|------|------|
| **Core model** | DAG executor (targets + prerequisites + timestamps) | Recipe runner (named commands) |
| **Dependency tracking** | Yes - timestamp-based | No |
| **Parallel execution** | `make -j4` (dependency-aware) | No built-in parallelism |
| **Arguments to targets** | Awkward (`make target ARG=value`) | Natural (`just target value`) |
| **Indentation** | Tabs required (recipe lines) | Any whitespace |
| **Variable expansion** | Two-stage (`$$` for shell `$`) | `{{var}}` for just vars, `$` for shell |
| **Interpreter choice** | Always shell (unless `.ONESHELL` + shebang hack) | Per-recipe shebang |
| **Dotenv loading** | Manual (`include .env` or `$(shell ...)`) | Built-in (`set dotenv-load := true`) |
| **Discoverability** | `make help` (if you write it) | `just --list` (automatic from comments) |
| **Dry-run** | `make -n` | `just --dry-run` |
| **Functions** | `$(call ...)`, `$(foreach ...)`, `$(if ...)` | Limited expressions |
| **Pattern rules** | `%.o: %.c` | None |
| **Include files** | `include path/file.mk` | `import 'path/file'` (v1.14+) |
| **Error on undefined variable** | No (expands to empty string silently) | `set allow-duplicate-variables := false` |
| **Portability** | POSIX make is standard; GNU make is Linux standard | Requires installation (`cargo install just`) |

### Decision Framework

**Use Make when:**
- You have a dependency graph (A depends on B depends on C)
- You want to skip completed work based on file timestamps
- You need parallel execution of independent targets
- You are building a pipeline where stages have prerequisites

**Use Just when:**
- You have named commands with no dependencies between them
- You want clean argument passing to recipes
- You want per-recipe interpreter choice
- You want self-documenting commands (`--list`)
- You want dotenv integration without boilerplate

**The project's split illustrates this perfectly:**
- The polecat pipeline (Makefile) has 26 tasks with explicit dependencies, convergence
  points, and timestamp-based skip logic. Make's DAG is essential.
- The research dev commands (justfiles) are independent operations: start a server,
  send a prompt, list jobs. No dependencies between them. Just's simplicity is
  appropriate.

> **AGENTIC GROUNDING:** Agents can generate both Makefiles and justfiles. The
> critical verification question is: "Does this task set have dependencies?" If yes,
> the agent should generate a Makefile with proper prerequisite declarations. If it
> generates a justfile for tasks with dependencies, the dependency enforcement is
> missing and tasks can run out of order. If it generates a Makefile for independent
> commands, the overhead of `.PHONY` and `$$` escaping is unnecessary complexity.
> Match the tool to the problem structure.

---

## 11. Advanced Make Patterns (~30 min)

### The .done/ State Machine

The project's `.done/` directory implements a state machine using the filesystem:

```make
DONE := .done

# Ensure the directory exists (executed at parse time)
$(shell mkdir -p $(DONE))

# Task with dependencies
07: $(DONE)/06 plans/07-bout-validation.md
	$(call POLECAT,plans/07-bout-validation.md)
	$(GATE)
	@touch $(DONE)/07
```

State transitions:
- **Not started**: `.done/07` does not exist
- **In progress**: recipe is running (no `.done/07` yet)
- **Complete**: `.done/07` exists
- **Invalidated**: a prerequisite's `.done/` file is newer (re-run needed)

```bash
ls .done/               # see completed tasks
rm .done/07             # force task 07 to re-run
touch .done/06          # invalidate 07 (and everything downstream)
rm -rf .done/           # reset everything (make clean does this)
```

This is the simplest possible state machine. No database, no service, no API. Files
exist or they do not. The filesystem IS the state store. Make's timestamp comparison
IS the state transition logic.

### Order-Only Prerequisites

Sometimes you need a directory to exist but do not want changes to the directory's
timestamp to trigger rebuilds:

```make
# Regular prerequisite - changes to $(DONE) trigger rebuild
07: $(DONE)/06 $(DONE)

# Order-only prerequisite - $(DONE) must exist, but timestamp ignored
07: $(DONE)/06 | $(DONE)

$(DONE):
	mkdir -p $@
```

The `|` separates normal prerequisites (left) from order-only prerequisites (right).
The project uses `$(shell mkdir -p $(DONE))` instead, which creates the directory at
parse time unconditionally.

### Conditional Execution

```make
TIER ?= full

gauntlet:
	@if [ "$(TIER)" = "full" ]; then \
		$(MAKE) darkcat-all; \
	fi
```

The project's gauntlet uses this to support tiered verification: full tier runs gate +
darkcats + pitkeel; docs tier and wip tier skip darkcats.

### Defensive Patterns

```make
# Ensure required tools exist before running
check-deps:
	@command -v claude >/dev/null 2>&1 || { echo "claude CLI not found"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found"; exit 1; }
	@command -v timeout >/dev/null 2>&1 || { echo "timeout not found"; exit 1; }

# Self-documenting help target
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
```

The `help` pattern extracts `## comment` annotations from target lines. Many projects
use this for discoverability. Just gets this for free with `--list`.

---

## 12. The Darkcat and Gauntlet Pipelines (~20 min)

### Darkcat: Multi-Model Adversarial Review

The `mk/darkcat.mk` file dispatches adversarial reviews across three different AI
models:

```make
# DC-1: Claude
darkcat:
	@timeout $(DARKCAT_TIMEOUT) claude -p "$$(cat $(DARKCAT_PROMPT))" \
		--allowedTools "Bash(git:*) Read" \
		> $(LOGS)/dc-$(TREE)-claude.log 2>&1

# DC-2: OpenAI (Codex)
darkcat-openai:
	@timeout $(DARKCAT_TIMEOUT) codex exec --sandbox read-only \
		"$$(cat $(DARKCAT_PROMPT))" \
		> $(LOGS)/dc-$(TREE)-openai.log 2>&1

# Parallel pair execution
darkcat-all:
	@$(MAKE) -j2 darkcat darkcat-openai
```

Key techniques:

- **Tree hash identity**: `$(TREE)` is the git tree hash computed at parse time. Log
  files are named with the tree hash, so reviews of different code states never
  collide. Same code state always produces the same log filename.
- **Parallel dispatch**: `$(MAKE) -j2 darkcat darkcat-openai` runs both reviews
  simultaneously. Each is independent (different model, same prompt, same code).
- **Attestation**: `$(PITCOMMIT) attest dc-claude --tree $(TREE_FULL)` records a
  cryptographic attestation that this specific tree hash was reviewed.
- **Tool restriction**: Claude gets `--allowedTools "Bash(git:*) Read"` - it can only
  run git commands and read files. It cannot modify anything. Codex gets
  `--sandbox read-only`. Both are restricted to observation.

### Gauntlet: The Full Pipeline

The `mk/gauntlet.mk` file sequences the three verification stages:

```make
gauntlet:
	@$(MAKE) gauntlet-gate       # 1. Quality gate (typecheck + lint + test)
	@$(MAKE) darkcat-all         # 2. Multi-model adversarial review
	@$(MAKE) gauntlet-pitkeel    # 3. Statistical analysis
```

This is sequential by design. The gate must pass before adversarial review begins
(no point reviewing code that does not compile). Pitkeel runs last because it depends
on the commit history being stable.

The tiered execution shows conditional logic within make:

```make
TIER ?= full

gauntlet:
	@$(MAKE) gauntlet-gate
	@if [ "$(TIER)" = "full" ]; then \
		$(MAKE) darkcat-all; \
	fi
	@$(MAKE) gauntlet-pitkeel
```

`TIER` is a make variable with a default of `full`, overridable from the command line:
`make gauntlet TIER=docs`.

---

## Challenge: Dependency Graph from Scratch

**Time: 30-40 min**

Create a Makefile that models a simple data pipeline with 8 targets:

```
download -> validate -> normalize -> transform -> aggregate -> report
                                  \-> export-csv
                                  \-> export-json
```

Requirements:
1. Each target creates a `.state/` marker file
2. Use `sleep 1` in recipes to simulate work
3. Declare `.PHONY` targets for `clean` and `status`
4. Verify with `make -n report` that the execution order is correct
5. Run `make -j4` and observe which targets run in parallel
6. Touch `normalize` marker and verify that downstream targets re-run
7. Add a `VERBOSE` flag that controls whether recipes echo their commands

```make
# Starter template - fill in the rest
SHELL := /bin/bash
STATE := .state

$(shell mkdir -p $(STATE))

# Your targets here...

clean:
	rm -rf $(STATE)

status:
	@echo "Completed:"; ls -1 $(STATE)/ 2>/dev/null || echo "  (none)"

.PHONY: clean status
```

Verify parallel execution by adding timing:

```bash
time make -j1 report    # serial - should take ~6 seconds (6 targets * 1s sleep)
make clean
time make -j4 report    # parallel - should be faster where independent targets exist
```

---

## Challenge: The $$ Escape Room

**Time: 20-30 min**

Write a Makefile recipe that correctly handles all of these shell constructs. Use
`make -n` to verify the shell sees the correct commands, then run them.

```make
escape-room:
	# 1. Use a shell loop variable
	@for i in 1 2 3; do echo "Item $$i"; done

	# 2. Use command substitution
	@echo "Date: $$(date +%Y-%m-%d)"

	# 3. Use a shell variable assignment
	@NAME="make-user"; echo "Hello $$NAME"

	# 4. Use $? (last exit code) - note: NOT make's $? automatic variable
	@true; echo "Exit: $$?"

	# 5. Use awk with $1 (awk's field variable, not make's)
	@echo "a:b:c" | awk -F: '{print $$2}'

	# 6. Combine make variable and shell variable
	@MSG="from $(SHELL)"; echo "$$MSG"
```

Predict the output before running. Then run and compare.

Now write a BROKEN version of the same recipe using single `$` everywhere, and use
`make -n` to see what make does to the commands before the shell sees them. This is
how you develop intuition for the two-stage expansion.

---

## Challenge: Rebuild the Status Target

**Time: 20 min**

The project's `make status` target uses a shell loop:

```make
status:
	@echo "Completed tasks:"
	@ls -1 $(DONE)/ 2>/dev/null | sort -n || echo "  (none)"
	@echo ""
	@echo "Remaining:"
	@for i in $$(seq -w 1 26); do \
		[ ! -f $(DONE)/$$i ] && echo "  $$i"; \
	done
```

Rewrite it using make functions instead of a shell loop. Use `$(wildcard ...)`,
`$(filter-out ...)`, and `$(foreach ...)`. Compare readability.

Which version is clearer? Which is easier to modify? There is no wrong answer here -
the question is about understanding the tradeoff between make-native and shell-native
approaches within make recipes.

---

## Challenge: File-Based State Machine

**Time: 30-40 min**

Build a four-stage data pipeline using make's timestamp model:

1. **download** - creates `data/raw.csv` (simulate with `echo`)
2. **validate** - reads `data/raw.csv`, creates `data/validated.csv`
3. **transform** - reads `data/validated.csv`, creates `data/transformed.csv`
4. **load** - reads `data/transformed.csv`, creates `data/loaded.flag`

Requirements:
- Use real file targets (not `.done/` markers) - the output files ARE the targets
- `make load` should run the full pipeline from scratch
- Re-running `make load` should do nothing (all targets up to date)
- `touch data/raw.csv` should cause validate, transform, and load to re-run
- `touch data/validated.csv` should cause only transform and load to re-run
- Add a `make clean` that removes all generated files

Then add a fifth stage: **archive** depends on **load** and creates a timestamped
tarball. Running `make archive` twice should create two different tarballs (because
the tarball name includes a timestamp, making the target always "new").

This exercise reveals the difference between file targets (make's natural model) and
phony targets (the project's `.done/` approach). Why might the project use `.done/`
markers instead of real file targets? (Hint: the "real output" of a polecat task is
not a single file - it is an arbitrary set of changes to the codebase.)

---

## Challenge: Justfile Equivalent

**Time: 20-30 min**

Translate these five targets from the project's Makefile into a justfile:

1. `status` - show completed and remaining tasks
2. `graph` - print the dependency tree
3. `clean` - remove all completion markers
4. `darkcat` - run DC-1 adversarial review
5. `gauntlet-gate` - run the quality gate

For each translation, note:
- What is easier in just? (arguments, interpreter choice, `--list` discoverability)
- What is impossible in just? (dependency tracking, parallel execution, timestamp logic)
- Where does just require you to manually enforce ordering that make handles
  automatically?

Write the complete justfile and test it.

---

## Challenge: Annotate the Real Makefile

**Time: 45-60 min**

This is a reading comprehension exercise. Read all four files of the project's
Makefile system (`Makefile`, `mk/polecats.mk`, `mk/darkcat.mk`, `mk/gauntlet.mk`)
and create annotated versions with inline comments explaining every line.

For each non-obvious construct, answer:
1. What does this line do?
2. Why is it written this way? (What alternative was rejected and why?)
3. What happens if this line is removed?

Pay particular attention to:
- The `.ONESHELL` directive and its interaction with the POLECAT wrapper
- The `TREE` vs `SHA` distinction and why tree hash is used for identity
- The `$$` escaping in the POLECAT wrapper
- The `$(MAKE)` calls in darkcat-all and gauntlet (why not just call the recipes
  directly?)
- The `$(shell mkdir -p ...)` at parse time vs creating directories in recipes
- The `.PHONY` declarations at the bottom (why not at the top, or next to each target?)

This exercise is complete when you can explain every line to someone who has never
seen a Makefile.

---

## Common Pitfalls

### 1. Spaces Instead of Tabs

```make
# This LOOKS right but fails with "missing separator"
target:
    echo "hello"    # these are spaces, not a tab

# This works
target:
	echo "hello"    # this is a tab character
```

Most editors can be configured to insert tabs in Makefiles. If you get "missing
separator" errors, check your indentation.

### 2. Silent Empty Expansion

```make
# If MYVAR is not defined, this silently expands to nothing
target:
	echo $(MYVAR)    # prints empty string, no error

# Defensive: check before use
target:
ifndef MYVAR
	$(error MYVAR is not defined)
endif
	echo $(MYVAR)
```

### 3. Recipe Lines Are Separate Shells

```make
# BROKEN (without .ONESHELL)
target:
	cd subdir
	pwd          # still in original directory!

# FIXED
target:
	cd subdir && pwd
```

### 4. Forgetting .PHONY

```make
# If a file called 'test' exists, this target never runs
test:
	pnpm run test

# Fixed
.PHONY: test
test:
	pnpm run test
```

### 5. Make Variable in Shell Context

```make
# BROKEN - make tries to expand $(i) as a make variable
target:
	for i in 1 2 3; do echo $(i); done

# FIXED - use $$ so shell sees $i
target:
	for i in 1 2 3; do echo $$i; done
```

---

## What to Read Next

[Step 7: Git Internals](/bootcamp/07-git-internals/) builds directly on this step. Where make uses file timestamps
to track state, git uses content-addressable storage (SHA hashes of file contents).
The project's `TREE := $(shell git write-tree)` variable in the Makefile is already
reaching into git's object model - the tree hash identifies the content state
independently of the commit history. Step 7 explains what `git write-tree` actually
does and why tree hashes solve identity problems that commit SHAs cannot.

The progression: Step 3 (filesystem as state) -> Step 6 (make uses filesystem state
for orchestration) -> Step 7 (git provides content-addressed filesystem state). Each
layer adds a new dimension to the same fundamental model.

---

## Summary

Make is a DAG executor. Its power is the dependency graph: declare what depends on
what, let make figure out execution order and skip completed work. The `$$` escaping
is the tax you pay for make's two-stage expansion model (make first, then shell).

Just is a recipe runner. Its power is simplicity: named commands with clean argument
handling, per-recipe interpreters, and built-in discoverability. The tradeoff is no
dependency tracking.

The project uses both where appropriate: make for the pipeline (dependencies matter),
just for dev commands (dependencies do not matter). The POLECAT wrapper, the `.done/`
state machine, the GATE verification pattern, and the multi-model darkcat dispatch are
all implemented as make recipes because their execution order is structurally
important and must be enforced by the tool, not by the operator's memory.

Understanding the orchestration layer means you can:
- Read any Makefile and know what will run, in what order, and why
- Spot missing dependencies that could cause race conditions under `-j`
- Verify that agent-generated build files correctly declare their dependency graphs
- Choose the right tool (make vs just) for the problem structure
- Debug the `$$` escaping issues that are inevitable in non-trivial recipes
