+++
title = "Advanced Bash - trap, coprocesses, associative arrays, BASH_REMATCH, and production patterns"
date = "2026-03-10"
description = "Signal traps, indexed and associative arrays, regex matching, coprocesses, process substitution, production-grade shell scripting patterns, and shellcheck."
tags = ["bash", "advanced", "shellcheck", "patterns", "bootcamp"]
step = 12
tier = 1
estimate = "3 hours"
bootcamp = 1
+++

Step 12 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 2 (shell language - word splitting, quoting, functions, error handling), Step 1 (process model, signals, file descriptors)
**You will need:** A Linux terminal (Arch, Debian, or Ubuntu), bash 5.x, shellcheck installed (`pacman -S shellcheck` / `apt install shellcheck`)

---

## Why This is Step 12

You have the full stack. Process model, shell language, filesystem, text pipelines, Python
CLI tools, Make, git internals, process observation, containers, networking, process
supervision. You can read, compose, and verify agent output across every layer of the
Linux execution environment.

This final step fills in the gaps. Bash has features beyond POSIX sh that Step 2
introduced but did not exhaust: signal traps, indexed and associative arrays, regex
matching, coprocesses, process substitution patterns, select menus, printf formatting,
and the collection of shopts and settings that constitute production-grade shell scripting.
These are the features that separate a script that works from a script that works reliably
- that handles signals, cleans up after itself, parses structured data without spawning
subprocesses, and fails loudly when something goes wrong.

None of this is portable to dash, ash, or POSIX sh. Every feature in this step requires
`#!/usr/bin/env bash` in the shebang line. Step 2 drew the line between POSIX and bash.
This step lives entirely on the bash side.

The capstone exercise - reviewing agent-generated scripts - ties together everything from
all twelve steps. By the end, you should be able to read any agent-generated shell script
and identify every class of bug: quoting errors (Step 2), pipeline subshell traps (Step 2),
missing cleanup traps (this step), unsafe glob handling (this step), missing error
handling (Step 2 + this step), process lifecycle issues (Step 1), filesystem assumptions
(Step 3), and incorrect text processing (Step 4).

---

## Table of Contents

1. [trap - Signal and Event Handling](#1-trap---signal-and-event-handling) (~25 min)
2. [Arrays (Indexed)](#2-arrays-indexed) (~20 min)
3. [Associative Arrays](#3-associative-arrays-bash-4) (~15 min)
4. [BASH_REMATCH and Regex Matching](#4-bash_rematch-and-regex-matching) (~15 min)
5. [Process Substitution and Named Pipes](#5-process-substitution-and-named-pipes) (~15 min)
6. [Coprocesses](#6-coprocesses-bash-4) (~10 min)
7. [select for Menus](#7-select-for-menus) (~5 min)
8. [printf Mastery](#8-printf-mastery) (~15 min)
9. [Bash Strict Mode and Production Patterns](#9-bash-strict-mode-and-production-patterns) (~20 min)
10. [Debugging Techniques](#10-debugging-techniques) (~15 min)
11. [The Complete Production Template](#11-the-complete-production-template) (~10 min)
12. [Challenges](#12-challenges) (~60-75 min)
13. [Bootcamp Complete](#bootcamp-complete)

---

## 1. trap - Signal and Event Handling

*Estimated time: 25 minutes*

Step 2 introduced `trap` as the shell's cleanup mechanism. This section goes deeper:
the full signal model, trap interactions with subshells and pipelines, execution order,
and the patterns that make production scripts resilient.

### The EXIT Trap - The Single Most Important Trap

```bash
cleanup() {
  rm -f "$tmpfile"
  kill "$bg_pid" 2>/dev/null
  wait "$bg_pid" 2>/dev/null
}
trap cleanup EXIT
```

`trap ... EXIT` runs the specified command on ANY exit from the shell: normal exit, `exit N`
called explicitly, `set -e` triggered exit, SIGINT (Ctrl-C), SIGTERM (kill). It is the
shell equivalent of a `finally` block in Python, a `defer` in Go, or a destructor in C++.

This is the trap you will use 95% of the time. If your script creates temporary files,
starts background processes, acquires locks, or modifies shared state, the EXIT trap is
how you guarantee cleanup. Without it, a script killed by a signal leaves garbage behind.

```bash
#!/usr/bin/env bash
set -euo pipefail

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# Work freely in $tmpdir
# No matter how the script exits, the directory is removed
cp important_data.txt "$tmpdir/"
process_stuff "$tmpdir/"
# If process_stuff fails (set -e triggers), cleanup still runs
```

### Signal-Specific Traps

```bash
# Run cleanup on specific signals
trap 'cleanup_function' SIGTERM SIGINT

# Ignore SIGINT (Ctrl-C) - the script cannot be interrupted
trap '' SIGINT

# Reset a signal handler to default behaviour
trap - SIGTERM
```

Ignoring signals is occasionally useful - for example, in a critical section where
partial execution would leave corrupted state. But ignoring SIGINT in a long-running
script is hostile to the user. Use it sparingly and always restore the default handler
when the critical section ends.

```bash
# Critical section pattern
trap '' SIGINT SIGTERM   # ignore signals during critical write
write_atomic_file "$output"
trap - SIGINT SIGTERM    # restore defaults
```

### The ERR Trap (Bash Extension)

```bash
trap 'printf "Error on line %d\n" "$LINENO" >&2; exit 1' ERR
```

The ERR trap fires when a command returns a non-zero exit code, subject to the same
exemptions as `set -e`: it does NOT fire in conditionals, after `&&` or `||`, or in
subshells (unless `errtrace` is set). It is useful for debugging but unreliable as a
sole error-handling mechanism.

Key distinction: put your cleanup logic in the EXIT trap, not the ERR trap. ERR fires
on errors. EXIT fires on everything, including errors. If you put cleanup in ERR, normal
exits skip cleanup. If you put cleanup in EXIT, all exits trigger cleanup.

### Trap Execution Order

When a command fails and both ERR and EXIT traps are set:

1. The ERR trap fires first
2. If the ERR trap calls `exit`, the EXIT trap fires next
3. If the ERR trap does not call `exit` and `set -e` is active, the shell exits and the EXIT trap fires

```bash
#!/usr/bin/env bash
set -euo pipefail

trap 'printf "ERR trap fired on line %d\n" "$LINENO" >&2' ERR
trap 'printf "EXIT trap fired with code %d\n" "$?" >&2' EXIT

false  # triggers ERR, then EXIT
```

Output:
```
ERR trap fired on line 6
EXIT trap fired with code 1
```

Design principle: ERR for diagnostics, EXIT for cleanup.

### Traps in Subshells

Traps are reset in subshells. This catches people.

```bash
#!/usr/bin/env bash
trap 'printf "EXIT from parent\n"' EXIT

# Subshell - trap is NOT inherited
(
  printf "In subshell\n"
  # The EXIT trap from the parent is not active here
  exit 1
)

printf "Parent continues\n"
```

Output:
```
In subshell
Parent continues
EXIT from parent
```

The subshell exits without running the parent's EXIT trap. If the subshell needs cleanup,
it must set its own trap.

This behaviour is by design: subshells are independent processes (or behave as if they
are). Their signal handlers are their own. This matches the process model from Step 1 -
`fork()` creates an independent process, and signal handlers in the child are reset.

### Traps and Pipelines

A command in a pipeline that receives SIGPIPE may not trigger the ERR trap. This is a
subtlety that matters when combining `set -o pipefail` with traps:

```bash
#!/usr/bin/env bash
set -euo pipefail
trap 'printf "ERR\n" >&2' ERR

# head closes its stdin after reading 1 line.
# The generating command receives SIGPIPE and dies.
# Whether ERR fires depends on which command's failure pipefail reports.
seq 1 1000000 | head -1
```

The practical advice: do not rely on ERR traps in pipeline contexts. Use EXIT for
cleanup, and check `${PIPESTATUS[@]}` explicitly if you need per-command exit codes
from a pipeline.

### The DEBUG Trap

```bash
# Fires before every simple command
trap 'printf "+ %s:%d: " "${BASH_SOURCE[0]}" "$LINENO"' DEBUG
```

This is for debugging, not production. Combined with `read`, it can step through a script
interactively:

```bash
trap 'read -p "[$LINENO] Press enter..."' DEBUG
```

> **AGENTIC GROUNDING:** The trap EXIT pattern is how production scripts clean up temp
> files, kill background processes, and restore state. Every agent-generated bash script
> that creates temp files should have this. When reviewing agent scripts, check for
> cleanup traps. The most common failure: an agent creates a temp file with `mktemp`
> but never cleans it up. Over time, `/tmp` fills with orphaned agent artifacts. The
> EXIT trap is the fix.

> **HISTORY:** `trap` comes from the Bourne shell (1979). The concept of handling signals
> in a shell language was novel - most languages at the time handled signals in C with
> `signal()` or `sigaction()`. The ERR and DEBUG traps are bash extensions with no POSIX
> equivalent. The EXIT trap (originally `trap ... 0` in Bourne shell, where 0 meant
> "on exit") is POSIX, making it the one trap pattern you can use everywhere.

---

## 2. Arrays (Indexed)

*Estimated time: 20 minutes*

Step 2 touched arrays briefly. This section covers them completely. Arrays are a bash
extension - POSIX sh has no arrays. The closest POSIX equivalent is the positional
parameter list (`$@`), which is a single array that you manipulate with `set --`.

### Declaration and Access

```bash
# Declare with parentheses
arr=(one two three)

# Access by index (0-based)
printf '%s\n' "${arr[0]}"    # one
printf '%s\n' "${arr[1]}"    # two

# All elements as separate words (ALWAYS quote this)
printf '%s\n' "${arr[@]}"
# one
# two
# three

# Length
printf '%d\n' "${#arr[@]}"   # 3

# Append
arr+=(four)
printf '%d\n' "${#arr[@]}"   # 4

# Assign to specific index (sparse arrays are allowed)
arr[10]=eleven
printf '%d\n' "${#arr[@]}"   # 5 (not 11 - bash arrays are sparse)
```

### Iteration

```bash
# The correct way - always quote "${arr[@]}"
for item in "${arr[@]}"; do
  printf 'Item: %s\n' "$item"
done

# With index
for i in "${!arr[@]}"; do
  printf '[%d] = %s\n' "$i" "${arr[$i]}"
done
```

### Array Slicing

```bash
arr=(a b c d e f)

# Elements 1 through 2 (offset:length)
printf '%s\n' "${arr[@]:1:2}"
# b
# c

# From element 3 to end
printf '%s\n' "${arr[@]:3}"
# d
# e
# f
```

### Why Arrays Matter: Filename Safety

The critical use case for arrays is safely handling lists of filenames, including those
with spaces, quotes, glob characters, and other adversarial content.

```bash
# WRONG - breaks on filenames with spaces
files=$(ls *.txt)
for f in $files; do
  printf '%s\n' "$f"
done

# CORRECT - glob expansion produces correctly delimited entries
files=(*.txt)
for f in "${files[@]}"; do
  printf '%s\n' "$f"
done
```

This connects directly to the quoting gauntlet from Step 2. The glob `*.txt` produces
an array where each element is a correctly delimited filename, regardless of what
characters the filename contains. Command substitution `$(ls *.txt)` produces a string
that is then word-split, breaking filenames with spaces.

### The Critical Difference: `"${arr[@]}"` vs `"${arr[*]}"`

This parallels `"$@"` vs `"$*"` in functions (Step 2):

```bash
arr=("first item" "second item" "third item")

# "${arr[@]}" - each element is a separate word
printf '[%s]\n' "${arr[@]}"
# [first item]
# [second item]
# [third item]

# "${arr[*]}" - all elements joined by first char of IFS into one word
printf '[%s]\n' "${arr[*]}"
# [first item second item third item]

# With custom IFS
IFS=,
printf '[%s]\n' "${arr[*]}"
# [first item,second item,third item]
```

Rule: `"${arr[@]}"` is almost always what you want. `"${arr[*]}"` is for joining
elements into a single string.

### Passing Arrays to External Commands

```bash
# Using printf + xargs for null-delimited safety
files=("file with spaces.txt" "another file.txt" "normal.txt")
printf '%s\0' "${files[@]}" | xargs -0 ls -la

# Passing as arguments (works if the array is not too large)
cp "${files[@]}" /backup/
```

> **AGENTIC GROUNDING:** Agents rarely use bash arrays. They default to space-separated
> strings and `for f in $(command)` patterns that break on adversarial filenames. When
> reviewing agent-generated scripts that process file lists, check: is the list stored in
> an array? Are array expansions quoted? Is `"${arr[@]}"` used instead of `${arr[@]}`
> (unquoted)? If the agent uses `$(ls ...)` or `$(find ...)` to build a file list, it
> is almost certainly broken for filenames with spaces.

> **HISTORY:** Bash arrays were added in bash 2.0 (1996), inspired by ksh (Korn shell)
> which had arrays earlier. The syntax differs: ksh uses `set -A arr val1 val2`, bash
> uses `arr=(val1 val2)`. The bash syntax won out in mindshare. POSIX never standardised
> arrays because the committee could not agree on syntax, so arrays remain a non-portable
> bash feature to this day.

---

## 3. Associative Arrays (Bash 4+)

*Estimated time: 15 minutes*

Associative arrays (hash maps, dictionaries) were added in bash 4.0 (2009). They map
string keys to string values. Unlike indexed arrays, they must be declared with
`declare -A`.

### Declaration and Access

```bash
# Must declare with -A
declare -A config

# Assign values
config[host]="localhost"
config[port]="5432"
config[database]="myapp"

# Access
printf '%s\n' "${config[host]}"    # localhost
printf '%s\n' "${config[port]}"    # 5432

# All keys
printf '%s\n' "${!config[@]}"
# host
# port
# database
# (order is NOT guaranteed)

# All values
printf '%s\n' "${config[@]}"

# Length (number of keys)
printf '%d\n' "${#config[@]}"    # 3

# Check if key exists
if [[ -v config[host] ]]; then
  printf 'host is set\n'
fi

# Delete a key
unset 'config[port]'
```

### Declare and Populate in One Step

```bash
declare -A colors=(
  [red]="#ff0000"
  [green]="#00ff00"
  [blue]="#0000ff"
)
```

### Iteration

```bash
declare -A status=(
  [web]="running"
  [db]="stopped"
  [cache]="running"
)

for key in "${!status[@]}"; do
  printf '%-10s %s\n' "$key" "${status[$key]}"
done
```

### Use Cases

**Counting occurrences:**

```bash
declare -A word_count

while IFS= read -r line; do
  for word in $line; do    # deliberate word splitting here
    (( word_count[$word]++ )) || true
  done
done < input.txt

for word in "${!word_count[@]}"; do
  printf '%4d %s\n' "${word_count[$word]}" "$word"
done | sort -rn
```

**Lookup tables:**

```bash
declare -A exit_codes=(
  [0]="success"
  [1]="general error"
  [2]="misuse of shell builtin"
  [126]="command not executable"
  [127]="command not found"
  [128]="invalid exit argument"
  [130]="terminated by Ctrl-C"
  [137]="killed by SIGKILL"
  [143]="terminated by SIGTERM"
)

code=$?
printf 'Exit %d: %s\n' "$code" "${exit_codes[$code]:-unknown}"
```

**Configuration maps:**

```bash
declare -A env_config

# Load from a simple key=value file
while IFS='=' read -r key value; do
  [[ "$key" =~ ^[[:space:]]*# ]] && continue   # skip comments
  [[ -z "$key" ]] && continue                    # skip empty lines
  env_config["$key"]="$value"
done < config.env
```

### Limitations

Bash associative arrays are flat. No nested structures. No arrays-of-arrays. No
maps-of-maps. Values are always strings. If your data structure needs nesting, you have
hit the bash ceiling - use Python (Step 5) or jq (Step 4) instead.

This is not a limitation to fight. It is a signal to switch tools. Bash excels at
orchestrating processes and handling text. It is not a general-purpose data structure
language.

> **AGENTIC GROUNDING:** Associative arrays in bash are how the POLECAT wrapper could
> track per-task state without external files. Currently it uses filesystem state
> (`.done/` files); associative arrays are the in-memory equivalent. When reviewing
> agent scripts that build lookup tables or count occurrences, check: did the agent
> declare the array with `declare -A`? Without it, bash treats the variable as an
> indexed array and the keys are silently converted to integer 0 - every assignment
> overwrites the same slot.

> **HISTORY:** Associative arrays appeared in bash 4.0 (2009). AWK had associative
> arrays from the beginning (1977), and Perl made them central to the language (1987).
> Bash was late to the party. The delay partly explains why so many shell scripts use
> temp files for lookup tables - the feature simply was not available when the patterns
> were established.

---

## 4. BASH_REMATCH and Regex Matching

*Estimated time: 15 minutes*

Step 2 introduced `[[ string =~ regex ]]` for regex matching in conditionals. This
section covers `BASH_REMATCH` - the array that holds capture groups after a successful
match.

### The Basics

```bash
version="12.4.7"

if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  printf 'Full match: %s\n' "${BASH_REMATCH[0]}"   # 12.4.7
  printf 'Major: %s\n' "${BASH_REMATCH[1]}"         # 12
  printf 'Minor: %s\n' "${BASH_REMATCH[2]}"         # 4
  printf 'Patch: %s\n' "${BASH_REMATCH[3]}"         # 7
else
  printf 'Not a valid version string\n' >&2
fi
```

`BASH_REMATCH[0]` is the entire match. `BASH_REMATCH[1]` through `BASH_REMATCH[N]` are
the capture groups in order.

### Important: Regex Quoting

The regex must NOT be quoted on the right side of `=~`. If you quote it, bash treats it
as a literal string match, not a regex:

```bash
# CORRECT - regex matching
[[ "hello123" =~ [0-9]+ ]]

# WRONG - literal string match (looks for the literal text "[0-9]+")
[[ "hello123" =~ "[0-9]+" ]]
```

If your regex contains spaces or special characters, assign it to a variable first:

```bash
pattern='^([a-z]+)[[:space:]]+([0-9]+)$'
if [[ "$line" =~ $pattern ]]; then
  printf 'Word: %s, Number: %s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
```

### Practical Examples

**Parsing git log output:**

```bash
# Custom git log format: hash|author|date|message
log_line="a1b2c3d|Alice|2026-03-10|Fix the widget parser"
pattern='^([a-f0-9]+)\|([^|]+)\|([0-9-]+)\|(.+)$'

if [[ "$log_line" =~ $pattern ]]; then
  hash="${BASH_REMATCH[1]}"
  author="${BASH_REMATCH[2]}"
  date="${BASH_REMATCH[3]}"
  message="${BASH_REMATCH[4]}"
  printf 'Commit %s by %s on %s: %s\n' "$hash" "$author" "$date" "$message"
fi
```

**Extracting fields from structured output:**

```bash
# Parse "key: value" lines
line="Content-Type: application/json; charset=utf-8"
if [[ "$line" =~ ^([^:]+):[[:space:]]*(.+)$ ]]; then
  header="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  printf 'Header: [%s] Value: [%s]\n' "$header" "$value"
fi
```

**Validating input:**

```bash
validate_email() {
  local email="$1"
  # Simplified - real email validation is more complex
  if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    return 0
  fi
  return 1
}

if validate_email "user@example.com"; then
  printf 'Valid\n'
fi
```

### When to Use BASH_REMATCH vs grep/sed/awk

- **BASH_REMATCH** - parsing one string in a conditional. No subprocess spawned. Fast in
  tight loops. Best for: validation, field extraction from a single line, conditional
  branching based on string structure.

- **grep** - filtering multiple lines. Spawns a subprocess. Best for: searching files,
  filtering streams, counting matches across many lines.

- **sed/awk** - transforming text. Spawns a subprocess. Best for: replacing patterns
  across files, columnar data processing, multi-line transformations.

The performance difference matters in loops. Each `grep` or `sed` call in a loop forks a
process. BASH_REMATCH operates in the current shell with no fork.

```bash
# Slow - forks grep 1000 times
for line in "${lines[@]}"; do
  if printf '%s' "$line" | grep -qE '^[0-9]+$'; then
    # ...
  fi
done

# Fast - no forks
for line in "${lines[@]}"; do
  if [[ "$line" =~ ^[0-9]+$ ]]; then
    # ...
  fi
done
```

> **AGENTIC GROUNDING:** BASH_REMATCH is how you parse structured output from agent
> processes without spawning grep/sed subprocesses. In tight loops where subprocess
> overhead matters - processing thousands of log lines, parsing build output, validating
> configuration values - BASH_REMATCH is the right tool. Agents tend to reach for
> grep/sed for everything because those tools dominate their training data. When reviewing
> agent scripts with loops that grep single strings, BASH_REMATCH is often the better
> choice.

---

## 5. Process Substitution and Named Pipes

*Estimated time: 15 minutes*

Step 2 introduced process substitution. This section covers the full picture: both
directions of process substitution, named pipes (FIFOs), and the relationship between
them.

### Process Substitution: `<()` and `>()`

`<(command)` produces a filename (like `/dev/fd/63`) that, when read, provides the
stdout of `command`. The command runs as a background process, and the kernel wires
its stdout to a pipe behind the file descriptor.

```bash
# Compare two sorted streams without temp files
diff <(sort file1.txt) <(sort file2.txt)

# See what the filename looks like
printf '%s\n' <(echo hello)
# /dev/fd/63  (or similar)

# Join two sorted files (join requires sorted input on specific fields)
join <(sort -k1,1 users.csv) <(sort -k1,1 orders.csv)
```

`>(command)` goes the other direction: it produces a filename that, when written to,
feeds the input to `command`:

```bash
# Write to compressed and plain simultaneously
tee >(gzip > archive.gz) > plain.txt < input.txt

# Send output to two different processing pipelines
some_command | tee >(grep ERROR > errors.log) >(grep WARN > warnings.log) > /dev/null

# Write to a file and compute a checksum simultaneously
tee >(sha256sum > checksum.txt) < bigfile.dat > /dev/null
```

### Practical Patterns

**Compare command outputs:**

```bash
# What changed in the package list after an install?
diff <(apt list --installed 2>/dev/null) <(apt list --installed 2>/dev/null)
# (More practically, save the first list to a file before the install)

# Compare environment before and after sourcing a script
diff <(env | sort) <(source setup.sh; env | sort)
```

**Merge sorted streams:**

```bash
# Merge three sorted log files by timestamp
sort -m <(sort log1.txt) <(sort log2.txt) <(sort log3.txt)
```

**Feed multiple inputs to a command:**

```bash
# paste combines files column-by-column
paste <(cut -d: -f1 /etc/passwd) <(cut -d: -f3 /etc/passwd)
```

### Named Pipes (FIFOs)

A named pipe is a process substitution that you manage manually. It appears as a file
in the filesystem but behaves like a pipe: a writer blocks until a reader opens the
other end, and vice versa.

```bash
# Create a named pipe
mkfifo /tmp/mypipe

# In terminal 1 (blocks until a reader connects):
printf 'Hello from writer\n' > /tmp/mypipe

# In terminal 2 (reads the data):
cat < /tmp/mypipe
# Hello from writer

# Clean up
rm /tmp/mypipe
```

Named pipes are useful when:
- Two processes need to communicate but neither can be started with process substitution
  (e.g., they are started by different scripts or at different times)
- You need a persistent communication channel between long-running processes
- The producing and consuming processes are managed independently

### Process Substitution vs Named Pipes

Process substitution is automatic - bash creates the pipe, manages the file descriptors,
and cleans up. Named pipes are explicit - you create, manage, and remove them. Process
substitution is scoped to the command; named pipes persist until you delete them.

Choose process substitution for one-shot patterns in a single command line. Choose named
pipes for inter-process communication across separate commands or scripts. In practice,
you will use process substitution far more often.

> **AGENTIC GROUNDING:** Process substitution enables powerful one-liners that avoid temp
> files. Agents can generate these, but you need to understand them to verify correctness.
> The common failure: an agent writes `diff $(sort file1) $(sort file2)` - command
> substitution, not process substitution. This captures the sorted output as strings,
> not filenames, and diff receives two strings as arguments instead of two file paths.
> The correct form is `diff <(sort file1) <(sort file2)`.

> **HISTORY:** Process substitution was invented by the Korn shell (ksh88) in 1988 and
> adopted by bash. It relies on the `/dev/fd/` filesystem, which originated in the 8th
> Edition of Research Unix (1985) at Bell Labs. Named pipes (FIFOs) are older - they
> were added to Unix in System III (1981). The two features together eliminated an entire
> class of temp-file bugs and made possible the "no intermediate files" pipeline style
> that is idiomatic in modern shell scripting.

---

## 6. Coprocesses (Bash 4+)

*Estimated time: 10 minutes*

A coprocess is a background process with bidirectional pipes. You can write to its
stdin and read from its stdout, all from the parent shell. This is bash's built-in
mechanism for interactive process communication.

### Syntax

```bash
# Named coprocess (bash 4.0+)
coproc MYPROC { bc -l; }

# Write to the coprocess
printf '22 / 7\n' >&"${MYPROC[1]}"

# Read from the coprocess
read -r result <&"${MYPROC[0]}"
printf 'Result: %s\n' "$result"
# Result: 3.14285714285714285714

# Send more
printf 'sqrt(2)\n' >&"${MYPROC[1]}"
read -r result <&"${MYPROC[0]}"
printf 'sqrt(2) = %s\n' "$result"

# Close the write end (signals EOF to the coprocess)
exec {MYPROC[1]}>&-

# Wait for it to finish
wait "$MYPROC_PID"
```

`${MYPROC[0]}` is the file descriptor for reading from the coprocess (its stdout).
`${MYPROC[1]}` is the file descriptor for writing to the coprocess (its stdin).
`$MYPROC_PID` is the PID of the coprocess.

### The Unnamed Coprocess

```bash
# Without a name (limited: only one unnamed coprocess at a time)
coproc { while IFS= read -r line; do printf 'ECHO: %s\n' "$line"; done; }

printf 'hello\n' >&"${COPROC[1]}"
read -r reply <&"${COPROC[0]}"
printf '%s\n' "$reply"
# ECHO: hello
```

### Why Coprocesses Are Fragile

In practice, coprocesses have several sharp edges:

1. **Buffering** - If the coprocess's output is fully buffered (which it often is when
   stdout is a pipe rather than a terminal), reads will block until the buffer fills or
   the process flushes. This is the same buffering issue from Step 1/Step 8 (stdbuf).

2. **Deadlocks** - Writing too much to the coprocess without reading can fill the pipe
   buffer (64KB on Linux), blocking the writer. If the writer is also the reader, deadlock.

3. **EOF handling** - You must close the write descriptor to signal EOF to the coprocess.
   Forgetting this leaves the coprocess hanging.

4. **Only one unnamed coprocess** - Starting a second unnamed coprocess kills the first.

### When to Use Coprocesses (Almost Never)

For interactive communication with long-running processes, `expect` (Tcl-based) or
Python's `pexpect` library handle the buffering and timing complexities far better.
Coprocesses are the "bash can technically do this" feature. Understanding them completes
the fd/pipe mental model from Step 1, but reaching for them in production is usually the
wrong call.

The valid use case: simple request-response protocols with line-buffered processes (like
`bc` or a custom line-oriented server). For anything more complex, use Python.

> **AGENTIC GROUNDING:** You are unlikely to see coprocesses in agent-generated scripts.
> But understanding the mechanism - bidirectional pipes wired to file descriptors -
> completes the mental model. When you see an agent trying to solve a bidirectional
> communication problem with temp files or polling, the underlying need is what
> coprocesses address. The right answer is usually to suggest Python, not bash coprocesses.

---

## 7. select for Menus

*Estimated time: 5 minutes*

`select` generates a numbered menu from a word list. It is the simplest interactive
input mechanism in bash.

```bash
PS3="Choose a color: "   # The prompt
select color in red green blue quit; do
  case "$color" in
    red|green|blue)
      printf 'You chose %s\n' "$color"
      ;;
    quit)
      break
      ;;
    *)
      printf 'Invalid choice\n' >&2
      ;;
  esac
done
```

Output:
```
1) red
2) green
3) blue
4) quit
Choose a color:
```

The user enters a number. `$REPLY` holds the raw input (the number). `$color` holds the
corresponding word. An invalid number sets `$color` to empty.

### Why This Section Is Short

In agent-native work, interactive menus are almost never the right interface. Agents
do not use menus. Scripts called by agents should accept arguments or read configuration
files, not prompt for input. `select` exists in bash, and you may encounter it in
legacy scripts, but you will not write it in new code.

Understanding it matters for one reason: when an agent encounters a script that blocks
on `select` input, you need to recognise what is happening and why the agent is stuck.

---

## 8. printf Mastery

*Estimated time: 15 minutes*

The standing order (from AGENTS.md and CLAUDE.md): never use `echo` to pipe values. Use
`printf`. This section explains why, and covers `printf` capabilities beyond basic
string output.

### Why printf Over echo

`echo` has two problems:

1. **Trailing newline** - `echo "value"` outputs `value\n`. When piped to another
   command, the newline is part of the data. This silently corrupts values in pipelines.

2. **Inconsistent behaviour** - `echo -n` suppresses the newline on GNU systems but
   prints literal `-n` on some BSD systems. `echo -e` enables escape sequences on some
   systems and prints literal `-e` on others. There is no portable `echo`.

`printf` has neither problem:

```bash
# Exactly "value" with no trailing newline
printf '%s' "value"

# "value" with an explicit newline
printf '%s\n' "value"

# The behaviour is identical across all POSIX systems
```

### Format Specifiers

```bash
# String
printf '%s\n' "$name"

# Integer
printf '%d\n' "$count"

# Zero-padded integer (useful for filenames that sort correctly)
printf '%05d\n' 42         # 00042

# Left-aligned string in a 20-character field
printf '%-20s %s\n' "$key" "$value"

# Right-aligned integer in a 10-character field
printf '%10d\n' "$number"

# Hexadecimal
printf '%x\n' 255          # ff
printf '%X\n' 255          # FF
printf '0x%08x\n' 255      # 0x000000ff

# Octal
printf '%o\n' 255           # 377

# Floating point (note: bash has no native floats, but printf can format them)
printf '%.2f\n' 3.14159    # 3.14
```

### Aligned Columns

```bash
# Report with aligned columns
printf '%-15s %8s %8s\n' "Service" "Status" "PID"
printf '%-15s %8s %8d\n' "nginx" "running" 1234
printf '%-15s %8s %8s\n' "postgres" "stopped" "-"
printf '%-15s %8s %8d\n' "redis" "running" 5678
```

Output:
```
Service            Status      PID
nginx             running     1234
postgres          stopped        -
redis             running     5678
```

### Date Formatting (Bash 4.2+)

```bash
# Current date/time using strftime format
printf '%(%Y-%m-%d %H:%M:%S)T\n' -1
# 2026-03-10 14:30:00

# Epoch time
printf '%(%s)T\n' -1
# 1773350000 (approximate)

# -1 means "now", -2 means "shell startup time"
printf 'Shell started: %(%Y-%m-%d %H:%M:%S)T\n' -2
```

This avoids spawning a `date` subprocess. In a loop that logs timestamps, this is
significantly faster.

### printf -v: Format Into a Variable

```bash
# Instead of: var=$(printf '%05d' "$n")  # spawns a subshell
# Use:
printf -v var '%05d' "$n"                 # no subshell

# Build a formatted string without a subprocess
printf -v timestamp '%(%Y%m%d_%H%M%S)T' -1
printf -v logfile '/var/log/app_%s.log' "$timestamp"
```

`printf -v` is a bash extension. It formats the output directly into the named variable
without forking a subshell. In tight loops, this matters.

### ANSI Colors

```bash
# Red text
printf '\x1b[31m%s\x1b[0m\n' "ERROR: something failed"

# Green text
printf '\x1b[32m%s\x1b[0m\n' "OK: tests passed"

# Bold yellow
printf '\x1b[1;33m%s\x1b[0m\n' "WARNING: check this"

# Define reusable color codes
RED='\x1b[31m'
GREEN='\x1b[32m'
YELLOW='\x1b[33m'
RESET='\x1b[0m'

printf "${RED}%s${RESET}\n" "This is red"
```

The `\x1b[` prefix is the ANSI escape sequence introducer. `31` is red, `32` is green,
`33` is yellow, `0` resets all attributes. These work in any terminal emulator.

> **AGENTIC GROUNDING:** `printf -v` and `printf '%()T'` are the two bash features that
> eliminate unnecessary subshells in performance-sensitive scripts. Agents default to
> `$(date +%Y%m%d)` and `var=$(printf ...)` because those patterns are more common in
> training data. When reviewing agent scripts that run in tight loops, replacing these
> with `printf -v` and `printf '%()T' -1` can be a significant performance improvement.

---

## 9. Bash Strict Mode and Production Patterns

*Estimated time: 20 minutes*

Step 2 covered `set -euo pipefail`. This section covers the additional shopts and
patterns that complete the production-grade bash setup.

### The Defensive Triple (Review)

```bash
set -euo pipefail
```

- `set -e` - exit on error (with exemptions for conditionals, `&&`, `||`)
- `set -u` - error on unset variables
- `set -o pipefail` - pipeline fails if any command fails

### IFS Hardening

```bash
IFS=$'\n\t'
```

The default IFS (Internal Field Separator) is space, tab, and newline. This means word
splitting occurs on all three. Setting IFS to only newline and tab means spaces no
longer cause word splitting:

```bash
# Default IFS - spaces cause splitting
IFS=$' \t\n'
for word in $(printf 'hello world\nfoo bar\n'); do
  printf '[%s]\n' "$word"
done
# [hello]
# [world]
# [foo]
# [bar]

# Hardened IFS - only newlines and tabs split
IFS=$'\n\t'
for word in $(printf 'hello world\nfoo bar\n'); do
  printf '[%s]\n' "$word"
done
# [hello world]
# [foo bar]
```

This is a safety net, not a substitute for proper quoting. But when combined with proper
quoting, it catches the cases you miss.

### shopt Settings for Production

```bash
# Error on unmatched globs (instead of passing the literal pattern)
shopt -s failglob

# Without failglob:
ls *.xyz     # if no .xyz files exist, ls receives literal "*.xyz" as argument
# With failglob:
ls *.xyz     # bash: no match: *.xyz (error, script exits with set -e)
```

```bash
# Unmatched globs expand to nothing (instead of the literal pattern)
shopt -s nullglob

# Without nullglob:
for f in *.xyz; do echo "$f"; done
# *.xyz  (iterates once with the literal pattern string)

# With nullglob:
for f in *.xyz; do echo "$f"; done
# (no output - loop body never executes)
```

`failglob` and `nullglob` are mutually exclusive in practice. `failglob` treats
unmatched globs as errors - good for scripts that expect files to exist. `nullglob`
treats them as empty - good for scripts that handle the empty case in the loop body.
Choose one based on your script's needs.

```bash
# Enable ** recursive glob
shopt -s globstar

# Without globstar:
ls **/*.txt    # ** is not special, matches nothing useful

# With globstar:
ls **/*.txt    # matches *.txt in all subdirectories recursively
```

```bash
# Run last pipeline command in current shell (bash 4.2+)
shopt -s lastpipe

# The variable-in-while-loop problem from Step 2:
count=0
printf 'a\nb\nc\n' | while IFS= read -r line; do
  (( count++ ))
done
printf '%d\n' "$count"
# Without lastpipe: 0 (while loop ran in subshell)
# With lastpipe: 3 (while loop ran in current shell)
```

`lastpipe` only works when job control is disabled (non-interactive scripts, or after
`set +m`). In interactive bash, job control is on by default, so `lastpipe` has no
effect. This makes it safe for scripts but not for interactive use.

### The set -e Debates

The bash community has long argued about whether `set -e` is helpful or harmful. The
pragmatic consensus:

**Arguments for `set -e`:**
- Catches gross errors (missing files, failed commands) that would otherwise cascade
- Forces the script author to handle expected failures explicitly (with `|| true` or
  conditionals)
- Better than no error handling at all

**Arguments against `set -e`:**
- The exemption rules are complex (conditionals, `&&`, `||`, subshells, command
  substitution) and create false confidence
- A script that "passes" under `set -e` may still have unhandled error cases
- It can mask the real error when a cleanup command in a trap also fails

**The practical position:** use `set -euo pipefail` as a safety net. Do not rely on it
as your sole error handling strategy. Write explicit error handling for commands that
may fail in expected ways:

```bash
set -euo pipefail

# Explicit handling for expected failure
if ! result=$(curl -sf "$url"); then
  printf 'Failed to fetch %s\n' "$url" >&2
  exit 1
fi

# || true for commands where failure is acceptable
grep -q "pattern" file.txt || true
```

### BASH_SOURCE and SCRIPT_DIR

```bash
# The directory containing the currently executing script
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The name of the script
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
```

`${BASH_SOURCE[0]}` is the path to the current script as it was invoked. Unlike `$0`,
it works correctly even when the script is `source`d from another script. `SCRIPT_DIR`
gives you the absolute path to the script's directory, which is essential for scripts
that need to reference files relative to their own location.

```bash
# Load a config file relative to the script
source "${SCRIPT_DIR}/config.sh"

# Reference a data file relative to the script
data_file="${SCRIPT_DIR}/../data/input.csv"
```

> **AGENTIC GROUNDING:** The production template (set -euo pipefail + trap + main) is
> what well-written agent scripts look like. When an agent generates a shell script
> without these, it is missing the safety net. The checklist: does the script have
> `set -euo pipefail`? Does it have a cleanup trap? Does it use `BASH_SOURCE` instead
> of `$0` for self-referencing paths? Does it wrap logic in a `main` function?
> Missing any of these is a code smell.

---

## 10. Debugging Techniques

*Estimated time: 15 minutes*

### Execution Tracing with set -x

```bash
# Enable trace - shows each command before execution
set -x
name="world"
printf 'Hello, %s\n' "$name"
set +x    # disable trace
```

Output:
```
+ name=world
+ printf 'Hello, %s\n' world
Hello, world
+ set +x
```

Each traced line is prefixed with `+` (the default value of `PS4`).

### Improved Trace Prefix

The default `+ ` prefix tells you nothing about where the command is. Set `PS4` to
include the source file and line number:

```bash
export PS4='+ ${BASH_SOURCE[0]##*/}:${LINENO}: '
set -x
```

Now traces show:
```
+ myscript.sh:12: name=world
+ myscript.sh:13: printf 'Hello, %s\n' world
```

For deeper call stacks, include the function name:

```bash
export PS4='+ ${BASH_SOURCE[0]##*/}:${LINENO} (${FUNCNAME[0]:-main}): '
```

### Tracing from the Command Line

```bash
# Trace the entire script from the start
bash -x script.sh

# Trace with custom PS4
PS4='+ ${BASH_SOURCE}:${LINENO}: ' bash -x script.sh
```

### Selective Tracing

```bash
# Only trace the problematic section
set -x
problematic_function "$arg1" "$arg2"
set +x
```

Or use a wrapper:

```bash
debug() {
  set -x
  "$@"
  { set +x; } 2>/dev/null    # suppress the "set +x" trace line
}

debug problematic_function "$arg1" "$arg2"
```

### Step-Through Debugging

```bash
# Pause before every command
trap 'read -p "[$LINENO] $BASH_COMMAND - Press enter..."' DEBUG
```

This uses the DEBUG trap (Section 1) to pause before each command, showing the line
number and the command about to execute. Press Enter to continue. This is the bash
equivalent of a breakpoint debugger.

### shellcheck - Static Analysis

`shellcheck` is the linter for shell scripts. It catches over 200 categories of bugs:

```bash
# Install
# Arch: pacman -S shellcheck
# Debian/Ubuntu: apt install shellcheck

# Run on a script
shellcheck myscript.sh

# Run with specific severity
shellcheck -S warning myscript.sh

# Output as JSON (for programmatic processing)
shellcheck -f json myscript.sh

# Check specific shell dialect
shellcheck -s bash myscript.sh
shellcheck -s sh myscript.sh    # POSIX mode
```

What shellcheck catches:

```bash
# SC2086: Double quote to prevent globbing and word splitting
echo $unquoted_var
#      ^-- shellcheck warns here

# SC2046: Quote this to prevent word splitting
files=$(find . -name "*.txt")
#       ^-- shellcheck warns here

# SC2002: Useless use of cat
cat file | grep pattern
# ^-- shellcheck warns: use grep pattern file instead

# SC2034: Variable appears unused
unused_var="hello"
# ^-- shellcheck warns

# SC2164: Use cd ... || exit in case cd fails
cd /some/dir
# ^-- shellcheck warns
```

shellcheck catches the exact class of bugs that agents introduce: unquoted variables,
useless cat, unreachable code, incorrect test operators, POSIX/bash confusion. Running
shellcheck on agent-generated scripts is a verification step equivalent to running a
type checker on TypeScript code.

### bashdb

`bashdb` is a source-level debugger for bash scripts, similar to gdb for C. It supports
breakpoints, step/next/continue, variable inspection, and stack traces. It is rarely
used in practice because `set -x` and `shellcheck` catch most issues, but it exists for
complex debugging scenarios:

```bash
# Install: pacman -S bashdb / apt install bashdb
# Run:
bashdb myscript.sh
# (bashdb) break 15       # breakpoint at line 15
# (bashdb) run             # start execution
# (bashdb) print $var      # inspect variable
# (bashdb) next            # step over
# (bashdb) step            # step into
# (bashdb) continue        # resume
```

> **AGENTIC GROUNDING:** `shellcheck` is the single most effective verification tool for
> agent-generated shell scripts. It catches bugs that visual review misses - unquoted
> variables in contexts where they appear safe but are not, command substitutions that
> should be quoted, POSIX violations in sh scripts. Adding `shellcheck script.sh` to
> your verification workflow catches a category of bugs before they reach execution.
> Agents should run shellcheck on their own generated scripts.

> **HISTORY:** shellcheck was created by Vidar Holen in 2012. It is written in Haskell
> and uses a custom shell parser (not bash's own parser) to analyse scripts statically.
> It has become the de facto standard for shell script quality, with integrations in
> every major editor and CI system. The project catches over 200 categories of shell
> bugs, each documented with explanations and examples at shellcheck.net. The existence
> of 200+ bug categories for a "simple" language like shell is itself a data point about
> shell's hidden complexity.

---

## 11. The Complete Production Template

*Estimated time: 10 minutes*

This is the reference template for production bash scripts. Every agent-generated script
that does real work should look like this. Keep this template and use it as a starting
point.

```bash
#!/usr/bin/env bash
#
# script-name.sh - One-line description of what this script does.
#
# Usage: script-name.sh [OPTIONS] <required-arg>
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

TMPDIR_CREATED=""

cleanup() {
  local exit_code=$?

  # Remove temp directory if we created one
  if [[ -n "${TMPDIR_CREATED:-}" ]]; then
    rm -rf "$TMPDIR_CREATED"
  fi

  # Kill background processes if any
  # kill "$bg_pid" 2>/dev/null || true
  # wait "$bg_pid" 2>/dev/null || true

  exit "$exit_code"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

VERBOSE=false

log() {
  if [[ "$VERBOSE" == true ]]; then
    printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*" >&2
  fi
}

die() {
  local code="${1:-1}"
  shift
  printf '%s: error: %s\n' "$SCRIPT_NAME" "$*" >&2
  exit "$code"
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

usage() {
  cat >&2 <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <input-file>

Process <input-file> and write results to stdout (or -o file).

Options:
  -o FILE   Write output to FILE (default: stdout)
  -v        Verbose logging to stderr
  -h        Show this help message

Examples:
  $SCRIPT_NAME data.txt
  $SCRIPT_NAME -v -o result.txt data.txt
EOF
}

# ---------------------------------------------------------------------------
# Argument Parsing
# ---------------------------------------------------------------------------

parse_args() {
  local output_file=""

  while getopts ":o:vh" opt; do
    case "$opt" in
      o) output_file="$OPTARG" ;;
      v) VERBOSE=true ;;
      h) usage; exit 0 ;;
      :) die 1 "Option -$OPTARG requires an argument" ;;
      *) die 1 "Unknown option: -$OPTARG. Use -h for help." ;;
    esac
  done
  shift $((OPTIND - 1))

  # Require positional argument
  if [[ $# -lt 1 ]]; then
    die 1 "Missing required argument: <input-file>. Use -h for help."
  fi

  INPUT_FILE="$1"
  OUTPUT_FILE="${output_file:-/dev/stdout}"
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

validate() {
  if [[ ! -f "$INPUT_FILE" ]]; then
    die 2 "Input file not found: $INPUT_FILE"
  fi

  if [[ ! -r "$INPUT_FILE" ]]; then
    die 2 "Input file not readable: $INPUT_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  parse_args "$@"
  validate

  log "Processing $INPUT_FILE"

  # Create temp directory for intermediate work
  TMPDIR_CREATED="$(mktemp -d)"
  log "Working directory: $TMPDIR_CREATED"

  # -----------------------------------------------------------------------
  # Your actual logic here
  # -----------------------------------------------------------------------

  # Example: process the input file
  local line_count
  line_count=$(wc -l < "$INPUT_FILE")
  log "Input has $line_count lines"

  # Write output
  printf 'Processed %d lines from %s\n' "$line_count" "$INPUT_FILE" > "$OUTPUT_FILE"

  log "Done"
}

main "$@"
```

### Why Each Part Matters

| Component | Purpose |
|-----------|---------|
| `set -euo pipefail` | Safety net for unhandled errors |
| `readonly SCRIPT_DIR` | Reliable self-referencing paths |
| `cleanup` + `trap EXIT` | Guaranteed resource cleanup |
| `log` function | Verbose output to stderr (does not contaminate stdout) |
| `die` function | Consistent error reporting with exit codes |
| `usage` function | Self-documenting, prints to stderr |
| `parse_args` with `getopts` | Standard argument handling |
| `validate` function | Fail fast on bad input |
| `main` function | All logic in main, called with `"$@"` |

The `main "$@"` pattern at the end ensures that the entire script is parsed before
any execution begins. Without it, a syntax error partway through the file could cause
partial execution of the top of the script. With `main "$@"`, bash parses the complete
file first, defines all functions, then calls `main`.

### Exit Code Conventions

```
0  - Success
1  - User error (bad arguments, missing input)
2  - System error (file not found, permission denied, command failed)
```

This matches the convention used by many Unix utilities. Scripts called by other scripts
or by agents should follow this convention so the caller can distinguish between "you
used it wrong" and "something broke."

---

## 12. Challenges

The challenges below are the capstone of the bootcamp. They build on everything from
Steps 1 through 12.

---

## Challenge: Trap Cleanup Laboratory

**Estimated time: 15 minutes**

Write a script called `trap-lab.sh` that:

1. Creates a temp directory with `mktemp -d`
2. Starts a background `sleep 300` process (simulating a long-running child)
3. Creates a lockfile at `/tmp/trap-lab.lock`
4. Does some "work" (sleep for a few seconds)
5. Has a cleanup function registered with `trap ... EXIT` that:
   - Removes the temp directory
   - Kills the background process
   - Removes the lockfile
   - Prints what it cleaned up to stderr

### Test Scenarios

Run the script under each of these conditions and verify cleanup runs in all cases:

```bash
# 1. Normal exit
bash trap-lab.sh

# 2. Ctrl-C (SIGINT) - press Ctrl-C during the sleep
bash trap-lab.sh

# 3. SIGTERM from another terminal
bash trap-lab.sh &
kill $!

# 4. set -e triggered error (add a failing command before the sleep)
# Modify the script to include: false
# between the setup and the sleep

# 5. Verify cleanup ran
ls /tmp/trap-lab.lock 2>/dev/null && printf 'FAIL: lockfile still exists\n' || printf 'OK: lockfile cleaned\n'
```

### Questions

- Does the cleanup function run in all four cases?
- What happens if you send SIGKILL (`kill -9`) instead of SIGTERM? Why?
- What happens if the cleanup function itself fails (e.g., the lockfile was already removed)?
  How do you make cleanup robust against partial state?

---

## Challenge: Array Safety Drill

**Estimated time: 10 minutes**

Create an array of adversarial filenames:

```bash
files=(
  "normal.txt"
  "has spaces.txt"
  "has  double  spaces.txt"
  'has "quotes".txt'
  "has 'single quotes'.txt"
  $'has\nnewline.txt'
  "has * glob.txt"
  ""                        # empty string
)
```

### Tasks

1. Write a loop that prints each filename on its own line, correctly handling all cases
   (including the empty string and the newline in a filename). Use `printf '%s\n'`, not
   `echo`.

2. Demonstrate the difference between `"${files[@]}"` and `${files[@]}` (unquoted) by
   printing the number of words each produces:

   ```bash
   # Quoted
   set -- "${files[@]}"
   printf 'Quoted: %d items\n' "$#"

   # Unquoted
   set -- ${files[@]}
   printf 'Unquoted: %d items\n' "$#"
   ```

   Explain why the numbers differ.

3. Show how to safely pass the array to `xargs`:

   ```bash
   printf '%s\0' "${files[@]}" | xargs -0 -I{} printf 'File: [%s]\n' "{}"
   ```

4. Create actual files with these names in a temp directory and process them with
   `find -print0 | xargs -0`. Compare the safety of this approach to `for f in $(ls)`.

---

## Challenge: BASH_REMATCH Parser

**Estimated time: 15 minutes**

Write a function `parse_git_log` that parses git log output using BASH_REMATCH.

### Setup

Generate test data:

```bash
git log --format='%h|%an|%ad|%s' --date=short -20 > /tmp/git-log-test.txt
```

If you are not in a git repo, create sample data:

```bash
cat > /tmp/git-log-test.txt <<'EOF'
a1b2c3d|Alice Smith|2026-03-10|Fix widget parser edge case
b2c3d4e|Bob Jones|2026-03-09|Add retry logic to API client
c3d4e5f|Alice Smith|2026-03-09|Refactor database connection pool
d4e5f6a|Charlie Lee|2026-03-08|Update dependencies to latest
e5f6a7b|Alice Smith|2026-03-08|Initial commit of auth module
f6a7b8c|Bob Jones|2026-03-07|Fix off-by-one in pagination
a7b8c9d|Charlie Lee|2026-03-07|Add health check endpoint
b8c9d0e|Alice Smith|2026-03-06|Remove deprecated API routes
c9d0e1f|Bob Jones|2026-03-06|Fix race condition in cache
d0e1f2a|Charlie Lee|2026-03-05|Add rate limiting middleware
EOF
```

### Tasks

1. Write a `parse_line` function that uses BASH_REMATCH to extract hash, author, date,
   and message from each line. Print them in a formatted table.

2. Write a `count_by_author` function that uses an associative array to count commits
   per author. Print the results sorted by count.

3. **Performance comparison:** Write a second version that uses `cut` (or `awk`) to
   extract the fields instead of BASH_REMATCH. Time both versions processing 1000 lines
   (replicate the test data):

   ```bash
   # Generate 1000 lines
   for i in $(seq 1 100); do cat /tmp/git-log-test.txt; done > /tmp/git-log-1000.txt

   time bash_rematch_version /tmp/git-log-1000.txt
   time cut_version /tmp/git-log-1000.txt
   ```

   Which is faster? Why? (Hint: BASH_REMATCH has no subprocess overhead per line, but
   bash loops are themselves slow. A single `awk` invocation processes all 1000 lines
   in one process.)

---

## Challenge: The Production Script

**Estimated time: 15 minutes**

Write a complete production-grade bash script called `linecount.sh` that:

1. Accepts `-v` (verbose), `-o <file>` (output), and `-h` (help) flags
2. Takes one or more input files as positional arguments
3. Validates that all input files exist and are readable
4. Creates a temp directory for intermediate work
5. Counts the lines in each input file
6. Outputs a summary table (filename, line count, percentage of total)
7. Has proper cleanup, error handling, and exit codes

### Requirements

- Use the production template from Section 11 as a starting point
- All logging to stderr, all output to stdout (or -o file)
- Handle filenames with spaces correctly
- Use arrays to store the file list
- Use an associative array to store per-file counts
- Use `printf` for all output (never echo)

### Verification

```bash
# Syntax check
bash -n linecount.sh

# shellcheck
shellcheck linecount.sh

# Normal operation
bash linecount.sh file1.txt file2.txt

# Verbose
bash linecount.sh -v file1.txt file2.txt

# Output to file
bash linecount.sh -o report.txt file1.txt file2.txt

# Missing file
bash linecount.sh nonexistent.txt
# Should exit 2 with clear error

# No arguments
bash linecount.sh
# Should exit 1 with usage

# Help
bash linecount.sh -h
# Should exit 0 with usage
```

---

## Challenge: Process Substitution Pipeline

**Estimated time: 10 minutes**

Solve each of the following problems using process substitution. No temp files allowed.

1. **Compare two command outputs:**
   Show the differences between the installed packages on this system and a reference
   list. (Simulate with two different sort orders of the same data.)

   ```bash
   # Compare sorted vs reverse-sorted
   diff <(sort /etc/passwd) <(sort -r /etc/passwd)
   ```

2. **Merge sorted streams:**
   Given three log files with timestamped lines, produce a single sorted output:

   ```bash
   sort -m <(sort log1.txt) <(sort log2.txt) <(sort log3.txt)
   ```

3. **Simultaneously compress and hash:**
   Write a file's contents to a gzip archive AND compute its sha256sum without reading
   the file twice:

   ```bash
   tee >(gzip > archive.gz) < input.txt | sha256sum
   ```

4. **Feed multiple inputs to paste:**
   Extract the first and third columns from `/etc/passwd` using process substitution
   and `paste`:

   ```bash
   paste <(cut -d: -f1 /etc/passwd) <(cut -d: -f3 /etc/passwd)
   ```

5. **Redirect to multiple destinations:**
   Run a command and send its stdout to both a file and a processing pipeline:

   ```bash
   ls -la /etc | tee >(wc -l > count.txt) >(grep "\.conf$" > configs.txt) > full-listing.txt
   ```

For each solution, explain what would be required if process substitution were not
available (typically: temp files, mkfifo, or restructuring the pipeline).

---

## Challenge: Shell Script Review Exercise

**Estimated time: 20 minutes**

This is the capstone exercise. It directly simulates the Operator's verification role:
reviewing agent-generated shell scripts for correctness, safety, and production quality.

Each script below was "generated by an agent." Each contains multiple bugs spanning
the topics from Steps 1 through 12. For each script:

1. Read the script and identify every bug you can find
2. Classify each bug by topic (quoting, error handling, cleanup, portability, process
   model, etc.)
3. Run shellcheck on the script and compare its findings with yours
4. Fix all bugs and verify the fixed version passes shellcheck

### Script 1: Backup Script

```bash
#!/bin/sh
# Agent-generated backup script

BACKUP_DIR=/backups/$(date +%Y%m%d)
SOURCE_DIR=$1

mkdir -p $BACKUP_DIR

for file in $(find $SOURCE_DIR -type f -name "*.log"); do
  cp $file $BACKUP_DIR/
  echo "Backed up: $file"
done

echo "Backup complete. $(ls $BACKUP_DIR | wc -l) files backed up."
```

**Bugs to find:** (try before reading)

<details>
<summary>Bug list</summary>

1. **Shebang says `#!/bin/sh` but no portability issues here - however the script lacks
   error handling.** Missing `set -e` or equivalent. If `mkdir -p` fails, the script
   continues copying to a nonexistent directory.
2. **Unquoted `$BACKUP_DIR`** in `mkdir -p` - breaks if date somehow produces spaces
   (unlikely here, but unquoted variables are a habit bug).
3. **Unquoted `$SOURCE_DIR` and `$file`** everywhere - breaks on paths with spaces.
4. **`$(find ... -name "*.log")` in a for loop** - word splitting breaks on filenames
   with spaces. Should use `find -exec` or `find -print0 | while`.
5. **No validation of `$1`** - if called with no arguments, `$SOURCE_DIR` is empty and
   `find` searches from the current directory.
6. **No cleanup trap** - if interrupted, partial backups remain without indication.
7. **`echo` instead of `printf`** - minor, but the standing order says `printf`.
8. **`ls $BACKUP_DIR | wc -l`** - unquoted, and `ls | wc -l` breaks on filenames with
   newlines.
9. **No exit code handling** - script always exits 0 even if cp fails.

</details>

### Script 2: Process Monitor

```bash
#!/usr/bin/env bash
# Agent-generated process monitor

PROCESS_NAME=$1
LOG_FILE=/var/log/monitor_$PROCESS_NAME.log
CHECK_INTERVAL=5

while true; do
  if ! pgrep -x $PROCESS_NAME > /dev/null 2>&1; then
    echo "[$(date)] $PROCESS_NAME is DOWN - restarting" >> $LOG_FILE
    systemctl restart $PROCESS_NAME
    sleep 10
  fi
  sleep $CHECK_INTERVAL
done
```

**Bugs to find:**

<details>
<summary>Bug list</summary>

1. **Missing `set -euo pipefail`** - no error handling.
2. **Unquoted `$PROCESS_NAME`** in pgrep, echo, systemctl, and log file path - if the
   process name contains spaces or special characters, multiple bugs fire.
3. **No validation of `$1`** - if empty, pgrep and systemctl receive empty arguments.
   `pgrep -x ""` matches nothing, so the script restarts "nothing" in a loop.
4. **No trap for cleanup** - if the monitor is killed, no indication in the log.
5. **Log file path contains unquoted variable** - `$LOG_FILE` constructed from unquoted
   input.
6. **`echo` instead of `printf`** for log entries.
7. **No log rotation or size limit** - the log grows forever.
8. **Running as an infinite loop without process supervision** - if this script dies,
   nothing restarts it. Should be a systemd service (Step 11).
9. **`systemctl restart` may require root** - no privilege check.
10. **Race condition** - between the pgrep check and the restart, the process may have
    already restarted on its own.

</details>

### Script 3: Deployment Script

```bash
#!/bin/bash
# Agent-generated deployment script

APP_DIR=/opt/myapp
REPO_URL=https://github.com/org/repo.git
BRANCH=main

cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

npm install
npm run build

if [ $? -eq 0 ]; then
  systemctl restart myapp
  echo "Deployment successful"
else
  echo "Build failed!"
fi
```

**Bugs to find:**

<details>
<summary>Bug list</summary>

1. **Missing `set -euo pipefail`** - if `cd` fails, the script runs git commands in the
   wrong directory. If `git fetch` fails, it continues. Cascading failures.
2. **`cd $APP_DIR` unquoted and unchecked** - the most dangerous line. If `$APP_DIR` is
   wrong or the directory does not exist, subsequent commands run in the current directory.
   Could `git pull` in the wrong repo or `rm -rf` the wrong path.
3. **No rollback mechanism** - if the build fails after git pull, the code is in a
   broken state. No way to recover to the previous version.
4. **`$?` after `npm run build` is fragile** - if any command is inserted between
   `npm run build` and the `if [ $? ... ]` check, `$?` reflects the wrong command.
   Use `if npm run build; then ...` directly.
5. **Unquoted `$BRANCH`** everywhere.
6. **No cleanup trap** - if interrupted mid-deployment, the application may be in an
   inconsistent state.
7. **No lock mechanism** - two simultaneous deployments would corrupt the application.
8. **`echo` instead of `printf`**.
9. **No logging** - deployment events should be recorded.
10. **No health check after restart** - the script reports success without verifying the
    application actually started.

</details>

### Script 4: Log Analyzer

```bash
#!/bin/bash
set -e

LOGFILE=$1
PATTERN=${2:-ERROR}

total=0
cat $LOGFILE | while read line; do
  if echo "$line" | grep -q "$PATTERN"; then
    total=$((total + 1))
    echo "Found: $line"
  fi
done

echo "Total matches: $total"
```

**Bugs to find:**

<details>
<summary>Bug list</summary>

1. **Pipeline subshell bug** (Step 2) - `cat $LOGFILE | while ...` runs the while loop
   in a subshell. `$total` is always 0 in the parent. This is the classic bug from
   Step 2's Pipeline Pitfalls challenge.
2. **Missing `-u` and `-o pipefail`** from the set flags.
3. **Unquoted `$LOGFILE`** in cat - breaks on paths with spaces.
4. **`cat $LOGFILE |`** is useless use of cat - use `while ... done < "$LOGFILE"`.
5. **`while read line`** missing `IFS=` and `-r` - leading/trailing whitespace is
   stripped and backslashes are interpreted. Should be `while IFS= read -r line`.
6. **`echo "$line" | grep -q`** forks grep for every line - extremely slow. Should use
   `[[ "$line" =~ $PATTERN ]]` (BASH_REMATCH, Section 4) or restructure to use a single
   grep invocation.
7. **No validation of `$1`** - if missing, `cat` reads from stdin (blocking forever).
8. **`echo` instead of `printf`**.
9. **Entire script could be replaced by `grep -c "$PATTERN" "$LOGFILE"`** - the agent
   has rebuilt grep badly.

</details>

### Script 5: File Processor

```bash
#!/usr/bin/env bash
set -euo pipefail

tmpfile=$(mktemp)
output=""

process_file() {
  local file=$1
  local count=$(wc -l < $file)
  output="$output$file: $count lines\n"
  cp $file $tmpfile
  # do some processing on tmpfile
  sed -i 's/foo/bar/g' $tmpfile
  cat $tmpfile >> /tmp/processed_output.txt
}

for f in $@; do
  process_file $f
done

echo -e "$output"
rm $tmpfile
```

**Bugs to find:**

<details>
<summary>Bug list</summary>

1. **No cleanup trap** - if the script fails, `$tmpfile` is never removed. The explicit
   `rm $tmpfile` at the end only runs on successful completion.
2. **`$@` unquoted in the for loop** - breaks on filenames with spaces. Must be
   `"$@"`.
3. **`$file` and `$tmpfile` unquoted** in `wc`, `cp`, `sed`, and `cat` - breaks on
   paths with spaces.
4. **`output` is a global variable modified in a function** - not declared local,
   which works here but is poor practice.
5. **`echo -e "$output"`** - non-portable, uses echo with flags (standing order
   violation). `\n` in the string is interpreted by `-e`. Should use `printf '%b' "$output"`
   or better yet, print each line individually.
6. **Single tmpfile reused across all files** - if `process_file` is called for multiple
   files, each call overwrites the tmpfile. The "processing" from the previous file is
   lost.
7. **`/tmp/processed_output.txt` is hardcoded** - no way to specify output location, and
   if the file already exists, results are appended to stale data.
8. **`$1` unquoted in `local file=$1`** - should be `local file="$1"`.
9. **`$(wc -l < $file)` - `$file` unquoted** inside the command substitution.
10. **No validation** - missing files, no arguments, permissions not checked.

</details>

### Scoring Yourself

For each script, count the bugs you found before reading the answers:

- **8+ per script** - you have internalized the patterns. You can review agent-generated
  scripts effectively.
- **5-7 per script** - good foundation, but some categories are not yet automatic.
  Review the topics you missed.
- **Under 5 per script** - go back to the relevant steps and re-read the sections on
  quoting (Step 2), error handling (Step 2), and cleanup (this step).

shellcheck will catch many of these bugs automatically. The skill you are building is
catching the bugs shellcheck cannot: architectural issues (no rollback, no health check),
process model bugs (pipeline subshell), and design problems (rebuilding grep badly).

---

## Bootcamp Complete

You have completed all twelve steps.

### The Journey

| Step | Topic | What You Gained |
|------|-------|-----------------|
| 1 | Process model | fork/exec, file descriptors, pipes, signals - the substrate everything runs on |
| 2 | Shell language | POSIX sh and bash - the language of process composition |
| 3 | Filesystem as state | Paths, permissions, /proc, /sys - the stateful namespace |
| 4 | Text pipeline | grep, sed, awk, jq - the data transformation layer |
| 5 | Python CLI tools | When shell hits its ceiling - structured data, complex logic, libraries |
| 6 | Make/Just | Orchestration of shell recipes - dependency graphs and build systems |
| 7 | Git internals | Beyond porcelain - objects, refs, the DAG that tracks all state |
| 8 | Process observation | strace, lsof, ss - seeing what processes actually do |
| 9 | Container internals | Namespaces, cgroups, overlay filesystems - processes in boxes |
| 10 | Networking CLI | curl, openssl, dig, tcpdump - diagnosing every network layer |
| 11 | Process supervision | systemd, cron - keeping processes alive and scheduled |
| 12 | Advanced bash | trap, arrays, BASH_REMATCH, production patterns - reliability |

### What You Can Do Now

You can read any agent-generated shell script, pipeline, Makefile, Dockerfile, systemd
unit, or Python CLI tool and identify what it does, what it gets wrong, and why. Not
because you memorised a list of gotchas, but because you understand the substrate.

When an agent constructs a pipeline that silently drops data, you see the subshell
boundary. When it writes a cleanup script that cannot survive SIGKILL, you know why -
SIGKILL is untrappable (Step 1). When it generates a Dockerfile with bash syntax in a
`/bin/sh` context, you see the POSIX violation (Step 2). When it produces a systemd unit
that does not handle reloads, you recognise the missing signal handler (Step 11). When it
writes a script without `set -euo pipefail` and a cleanup trap, you know the failure modes
it has left open (Steps 2, 12).

This is the Operator's verification capacity. It does not replace the agent's ability to
generate code. It provides the independent judgment that keeps the agent's output honest.
The agent generates fluently. You verify accurately. That combination is the agentic
engineering model.

### What This Does Not Cover

This bootcamp is the substrate layer - Linux, shell, processes, filesystems, networking.
It does not cover:

- Application-layer frameworks (React, Django, Rails)
- Cloud provider APIs (AWS, GCP, Azure)
- Database internals (query planners, index structures, replication)
- Machine learning infrastructure (training, inference, deployment)
- Security beyond basic permissions and TLS

These are the layers above the substrate. They change faster, depend on the substrate,
and are better documented. With the substrate understood, learning any of them is a
matter of reading documentation - not a matter of building missing mental models.

### The Standing Principle

Do not infer what you can verify. If an agent's output looks right, verify it. If a
pipeline's behaviour is unclear, trace it. If a script's cleanup logic seems complete,
test it with SIGTERM. The tools from these twelve steps make verification fast and
definitive. Use them.

---

## Quick Reference: Production Script Checklist

When reviewing any agent-generated bash script, check:

```
[ ] Shebang: #!/usr/bin/env bash (not #!/bin/sh unless POSIX-only)
[ ] set -euo pipefail
[ ] trap cleanup EXIT (if script creates temp files or background processes)
[ ] All variables quoted ("$var", "${arr[@]}")
[ ] Input validation (arguments checked before use)
[ ] printf instead of echo (the standing order)
[ ] BASH_SOURCE for self-referencing paths (not $0)
[ ] main "$@" pattern (parse before execute)
[ ] shellcheck passes with no warnings
[ ] Cleanup function handles partial state (uses ${var:-} for possibly unset vars)
[ ] Exit codes: 0 success, 1 user error, 2 system error
[ ] Logging to stderr, output to stdout
[ ] No useless use of cat
[ ] find with -exec or -print0 (not $(find ...) in a for loop)
[ ] Arrays for file lists (not space-separated strings)
```

---

## Quick Reference: Bash Features Not In POSIX sh

Keep this table when deciding whether a feature is safe in a `#!/bin/sh` script.

| Feature | POSIX sh | Bash | Used in this step |
|---------|----------|------|-------------------|
| `[[ ]]` | No | Yes | Sections 4, 9 |
| Indexed arrays | No | Yes | Section 2 |
| Associative arrays | No | 4.0+ | Section 3 |
| `BASH_REMATCH` | No | Yes | Section 4 |
| Process substitution `<()` | No | Yes | Section 5 |
| Coprocesses | No | 4.0+ | Section 6 |
| `select` | No | Yes | Section 7 |
| `printf -v` | No | Yes | Section 8 |
| `printf '%()T'` | No | 4.2+ | Section 8 |
| `set -o pipefail` | No | Yes | Section 9 |
| `shopt` | No | Yes | Section 9 |
| `BASH_SOURCE` | No | Yes | Section 9 |
| `trap ... ERR` | No | Yes | Section 1 |
| `trap ... DEBUG` | No | Yes | Section 1, 10 |

---

## What to Read Next

This is the final step in Bootcamp I. The twelve-step substrate layer is complete.

If you are ready to continue, [Bootcamp II: How LLMs Work](/bootcamp/ii-01-how-llms-work/) picks up where this leaves off - moving from the execution substrate to the model layer.

If you completed the bootcamp linearly, go back to the steps you rushed through. The
material rewards re-reading with deeper understanding. Step 1 (process model) and Step 2
(shell language) in particular - they are the foundation, and everything you learned in
Steps 3 through 12 adds context that makes them richer on a second pass.

If you want to go deeper on specific topics:

- **Advanced shell:** "The Bash Reference Manual" (GNU) is the authoritative source.
  Read it section by section - it is not a tutorial, it is a specification.
- **Shell portability:** "The POSIX Shell and Utilities" specification (IEEE 1003.1).
  Dry but definitive.
- **shellcheck wiki:** Each diagnostic code (SC1000-SC2999) has a detailed explanation
  with examples at https://www.shellcheck.net/wiki/
- **Process model:** "Advanced Programming in the UNIX Environment" (Stevens, Rago). The
  book that defines the territory.
- **Linux internals:** "The Linux Programming Interface" (Kerrisk). The modern reference
  for everything in Steps 1, 3, 8, and 9.

> **HISTORY:** The Bourne shell was written by Stephen Bourne at Bell Labs and released
> in Version 7 Unix (1979). Bash was written by Brian Fox for the GNU Project in 1989.
> The POSIX shell standard was published in 1992. Bash 4.0 (with associative arrays and
> coprocesses) was released in 2009. Bash 5.0 was released in 2019. The shell has been
> evolving for over 45 years, and it remains the primary interface between humans and Unix
> systems, and between agents and Unix systems. Understanding it is not optional.
