+++
title = "The Shell Language"
date = "2026-03-10"
description = "POSIX sh then bash. Quoting, expansion, control flow, error handling. The glue that composes processes."
tags = ["shell", "bash", "posix", "scripting", "bootcamp"]
step = 2
tier = 1
estimate = "8-12 hours"
bootcamp = 1
+++

Step 2 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model, file descriptors, pipes, signals)
**You will need:** A Linux terminal (Arch, Debian, or Ubuntu), bash 5.x

## Table of Contents

1. [The Shell is a Process Launcher](#1-the-shell-is-a-process-launcher) (30 min)
2. [Word Splitting and Quoting](#2-word-splitting-and-quoting) (90 min)
3. [Variables and Parameter Expansion](#3-variables-and-parameter-expansion) (60 min)
4. [Command Substitution and Subshells](#4-command-substitution-and-subshells) (60 min)
5. [Control Flow](#5-control-flow) (60 min)
6. [Functions](#6-functions) (45 min)
7. [Error Handling](#7-error-handling) (60 min)
8. [POSIX sh vs Bash](#8-posix-sh-vs-bash) (45 min)
9. [Here Documents and Here Strings](#9-here-documents-and-here-strings) (30 min)
10. [Challenges](#challenges) (3-4 hours)

---

## 1. The Shell is a Process Launcher

**Estimated time: 30 minutes**

The shell is a process launcher, not a programming language.

Then contradict this.

At its core, here is what the shell does for external commands:

1. Read a line
2. Parse it (tokenize, identify operators, apply grammar)
3. Perform expansions (parameter, command substitution, arithmetic, etc.)
4. Find the command (built-in, function, or external binary in `$PATH`)
5. For external commands: `fork()` a child process, `exec()` the command in the child, `wait()` for it to finish
6. Check the exit code
7. Repeat

Builtins (`cd`, `echo`, `[`, `export`) and shell functions execute in the current
process - no fork/exec. Variable assignments and compound commands (`if`, `while`,
`{ ... }`) also run without forking. The fork/exec/wait cycle is specifically for
launching external binaries. But it is the *defining* operation - the thing that makes
the shell a shell rather than a programming language.

Everything else - variables, control flow, functions, redirection, quoting
rules, expansion, globbing - was bolted on top of this process-launching loop over
decades. The Bourne shell (1979) added programming constructs. Bash (1989) added more.
POSIX standardised a subset. But the core purpose never changed.

This explains every quirk you will encounter:

- **Why `if` takes a command, not a boolean expression.** The shell runs the command and
  checks its exit code. `if grep -q pattern file; then ...` works because `grep` returns
  0 (success) or 1 (failure). There is no true/false type - there are only exit codes.

- **Why `[ ]` has spaces.** `[` is a command. In bash it is a shell builtin; an external
  version also exists at `/usr/bin/[`. Either way, `[ -f foo ]` is the command `[` with
  arguments `-f`, `foo`, and `]`. The spaces are argument delimiters, not style.

- **Why variable assignment has no spaces.** `var=value` is an assignment. `var = value`
  runs the command `var` with arguments `=` and `value`. The parser distinguishes these
  by looking for the `=` with no surrounding whitespace.

- **Why quoting matters.** After the shell expands variables (parameter expansion), it
  performs word splitting on the *results* of unquoted expansions. This is a separate
  step from the initial parsing/tokenization. If a variable contains spaces, the shell splits it into multiple words, and each word
  becomes a separate argument to the command. This is not a bug - it is the design.

Now the contradiction: the shell IS a programming language. It has variables, conditionals,
loops, functions, arrays (in bash), associative arrays (in bash 4+), arithmetic, string
manipulation, and signal handling. It is Turing-complete. But it is a programming language
built on top of a process launcher, and the process launcher semantics leak through
everywhere. Every line of shell is simultaneously a program statement AND a process
invocation specification. Forgetting either aspect produces bugs.

> **AGENTIC GROUNDING:** Agents generate shell fluently because their training data is
> full of shell scripts. But they generate it as a programming language - they think in
> variables, loops, and conditionals. They do not think about the process launcher
> underneath. This is why agent-generated shell often looks correct, passes a syntax
> check, and breaks at runtime on edge cases. The most common failures: unquoted
> variables (word splitting), relying on echo behaviour that varies across platforms,
> and not understanding that piped commands run in subshells.

> **HISTORY:** The Thompson shell (1971) was the first Unix shell. It was literally just
> a command interpreter - no variables, no control flow, no scripting. Ken Thompson wrote
> it as a way to launch programs. Pipes were not even in the first version; Doug McIlroy
> pushed for them and they were added in 1973. The Bourne shell (1979) by Steve Bourne at
> Bell Labs added programming constructs. Bourne's previous project was an ALGOL 68
> compiler, which is why shell has `if/then/fi`, `case/esac`, and `do/done` - the
> reversed-keyword block delimiters are ALGOL's influence. This lineage matters: the
> programming features were designed by a compiler writer who was building ON TOP of a
> process launcher, not replacing it.

### Verify it yourself

```bash
# Prove that [ is a command (type -a shows builtins AND externals)
type -a [
# [ is a shell builtin
# [ is /usr/bin/[

ls -la /usr/bin/[
# -rwxr-xr-x 1 root root ... /usr/bin/[

# Prove that assignment vs command depends on whitespace
foo=hello    # assignment: no output, $? is 0
foo = hello  # command: "foo: command not found", $? is 127
```

---

## 2. Word Splitting and Quoting

**Estimated time: 90 minutes**

This is the single most important section in this entire bootcamp step. Word splitting
and quoting are where the majority of shell bugs live, and they are the class of bug
that agents produce most reliably.

### The Shell's Evaluation Order

When the shell processes a line, it applies transformations in this exact order:

1. **Brace expansion** - `{a,b,c}` becomes three words: `a b c`
2. **Tilde expansion** - `~` becomes `$HOME`
3. **Parameter/variable expansion** - `$var` and `${var}` become the variable's value
4. **Command substitution** - `$(command)` becomes the command's stdout
5. **Arithmetic expansion** - `$((1 + 2))` becomes `3`
6. **Word splitting** - the result is split on characters in `$IFS` (default: space, tab, newline)
7. **Pathname expansion (globbing)** - `*`, `?`, `[...]` are expanded to matching filenames
8. **Quote removal** - quotes that survived all the above are stripped

This order is not arbitrary. Each step's output feeds the next. The critical insight:
**steps 6 and 7 happen AFTER variable expansion (step 3)**. This means the VALUE of a
variable is subject to word splitting and globbing unless you prevent it with quotes.

### The Three Quoting Modes

**No quotes - everything happens:**

```bash
file="my document.txt"
rm $file
# Shell expands $file to: my document.txt
# Word splitting splits on space: "my" "document.txt"
# rm receives TWO arguments: "my" and "document.txt"
# Result: tries to delete two files, neither of which exists
```

**Double quotes - expansion happens, word splitting does not:**

```bash
file="my document.txt"
rm "$file"
# Shell expands $file to: my document.txt
# Double quotes SUPPRESS word splitting
# rm receives ONE argument: "my document.txt"
# Result: deletes the correct file
```

**Single quotes - nothing happens:**

```bash
file="my document.txt"
echo '$file'
# Output: $file
# Single quotes suppress ALL expansion
# The literal string $file is passed to echo
```

### The Rule

**Always double-quote variable expansions unless you specifically want word splitting.**

This is not a style preference. It is a correctness requirement. Unquoted `$var` is
correct only when you intentionally want the value split into multiple words. In
practice, this is rare.

```bash
# WRONG - word splitting and globbing
for f in $(find . -name "*.log"); do rm $f; done

# What happens with a file named "access log.txt":
# find outputs: ./access log.txt
# $(...) captures it
# Unquoted, word splitting produces: "./access" "log.txt"
# rm tries to delete two nonexistent files
# The actual file is untouched

# WRONG EVEN IF QUOTED PARTIALLY
for f in "$(find . -name "*.log")"; do rm "$f"; done
# Now the ENTIRE find output is one string (all filenames concatenated)

# CORRECT - use find -exec
find . -name "*.log" -exec rm {} \;

# CORRECT - use null-delimited read
while IFS= read -r -d '' f; do
  rm "$f"
done < <(find . -name "*.log" -print0)
```

### Globbing After Expansion

Word splitting is not the only danger. Pathname expansion (globbing) also happens
after variable expansion:

```bash
msg="File not found: *"
echo $msg
# Unquoted: * is expanded to all files in current directory
# Output: File not found: Makefile README.md src tests ...

echo "$msg"
# Quoted: no globbing
# Output: File not found: *
```

### IFS - The Internal Field Separator

Word splitting splits on characters in `$IFS`. The default is space, tab, newline.
You can change it:

```bash
# Parse a colon-delimited string (like $PATH)
IFS=: read -ra parts <<< "$PATH"
for p in "${parts[@]}"; do
  echo "$p"
done

# Read a CSV line
IFS=, read -r name age city <<< "Alice,30,London"
echo "$name is $age years old, lives in $city"
```

Setting `IFS=` (empty) disables word splitting entirely. This is useful in `while read`
loops where you want to preserve leading/trailing whitespace:

```bash
# Without IFS= : leading/trailing whitespace stripped
echo "  hello  " | while read line; do echo "[$line]"; done
# Output: [hello]

# With IFS= : whitespace preserved
echo "  hello  " | while IFS= read -r line; do echo "[$line]"; done
# Output: [  hello  ]
```

The `-r` flag on `read` prevents backslash interpretation. Always use `read -r` unless
you specifically want backslash escapes processed.

### printf vs echo - The Standing Order

From AGENTS.md and CLAUDE.md:

> NEVER use `echo` to pipe values to CLI tools. `echo` appends a trailing newline that
> silently corrupts values. ALWAYS use `printf` instead.

Here is why, grounded in the shell evaluation model:

```bash
# echo adds a trailing newline
echo "true" | xxd | head -1
# 00000000: 7472 7565 0a         true.

# printf does not (unless you ask for one)
printf 'true' | xxd | head -1
# 00000000: 7472 7565           true

# When piping to a CLI tool that reads exact bytes:
echo "true" | vercel env add MY_FLAG production
# The value stored is "true\n" - five bytes, not four

printf 'true' | vercel env add MY_FLAG production
# The value stored is "true" - four bytes, correct
```

But there is more. `echo` behaviour varies between implementations:

```bash
# bash built-in echo: -e enables escape sequences
echo -e "hello\tworld"    # Output: hello	world

# /bin/echo on some systems: -e is printed literally
/bin/echo -e "hello\tworld"   # Output: -e hello\tworld  (on some systems)

# POSIX says echo behaviour with -e, -n, or backslashes is UNDEFINED
# This means the same script produces different output on different systems

# printf is consistent everywhere:
printf 'hello\tworld\n'   # Output: hello	world  (always)
```

The rule: use `printf` when the exact bytes matter (piping to tools, writing to files,
constructing data). Use `echo` only for casual human-readable messages to the terminal
where a trailing newline is wanted and escapes are irrelevant.

> **AGENTIC GROUNDING:** Agents default to `echo` in almost all generated shell. When
> reviewing agent-generated scripts, every `echo "$value" | some_command` is a potential
> bug. The Operator must verify whether the trailing newline matters. In CI pipelines,
> secret injection, and environment variable setting, it almost always matters.

---

## 3. Variables and Parameter Expansion

**Estimated time: 60 minutes**

Shell variables are untyped strings. There are no integers, no booleans, no arrays in
POSIX sh (bash adds arrays). Everything is a string, and operations on variables are
string operations.

### Basic Assignment and Expansion

```bash
name="world"
echo "Hello, $name"         # Hello, world
echo "Hello, ${name}"       # Hello, world (braces for clarity/disambiguation)
echo "Hello, ${name}ling"   # Hello, worldling (braces required here)
echo "Hello, $nameling"     # Hello,  (variable $nameling is unset)
```

No spaces around `=`. This is not style - it is syntax. `name = "world"` runs the
command `name` with arguments `=` and `world`.

### Parameter Expansion Operators

These are not curiosities. They are how you avoid spawning subprocesses for simple
string operations. Every `$(echo "$var" | sed 's/...')` could be a parameter expansion
that runs in the shell process itself, with zero fork/exec overhead.

**Default values:**

```bash
# ${var:-default} - use default if var is unset or empty
echo "${EDITOR:-vi}"           # prints vi if $EDITOR is not set

# ${var:=default} - assign default if var is unset or empty
echo "${cache_dir:=/tmp/cache}"  # assigns AND uses the default

# ${var:?error} - exit with error if var is unset or empty
: "${DATABASE_URL:?DATABASE_URL must be set}"
# If DATABASE_URL is unset, prints error message and exits with code 1
# The : command is a no-op (true) - it exists solely to trigger the expansion

# ${var:+alternate} - use alternate if var is set AND non-null
echo "${DEBUG:+--verbose}"     # prints --verbose only if DEBUG is set and non-empty
```

**String stripping (prefix and suffix removal):**

```bash
filepath="/home/user/documents/report.tar.gz"

# ${var#pattern}  - strip shortest prefix match
echo "${filepath#*/}"          # home/user/documents/report.tar.gz

# ${var##pattern} - strip longest prefix match
echo "${filepath##*/}"         # report.tar.gz  (basename equivalent!)

# ${var%pattern}  - strip shortest suffix match
echo "${filepath%.*}"          # /home/user/documents/report.tar

# ${var%%pattern} - strip longest suffix match
echo "${filepath%%.*}"         # /home/user/documents/report

# Mnemonic: # is on the left side of $ on a US keyboard (prefix)
#            % is on the right side of $ on a US keyboard (suffix)
```

**Practical applications - no external commands needed:**

```bash
# Extract directory (like dirname)
path="/home/user/file.txt"
dir="${path%/*}"               # /home/user

# Extract filename (like basename)
file="${path##*/}"             # file.txt

# Extract extension
ext="${file##*.}"              # txt

# Extract name without extension
name="${file%.*}"              # file

# Change extension
newpath="${path%.*}.md"        # /home/user/file.md
```

**Substitution (bash extension - also POSIX in some forms):**

```bash
# ${var/pattern/replacement} - replace first match
msg="hello world"
echo "${msg/world/shell}"      # hello shell

# ${var//pattern/replacement} - replace ALL matches
path="a/b/c/d"
echo "${path////-}"            # a-b-c-d

# ${var/#pattern/replacement} - replace if at start
echo "${msg/#hello/goodbye}"   # goodbye world

# ${var/%pattern/replacement} - replace if at end
echo "${msg/%world/bash}"      # hello bash
```

**Length:**

```bash
str="hello"
echo "${#str}"                 # 5
```

**Substring (bash extension):**

```bash
str="hello world"
echo "${str:6}"                # world  (from position 6 to end)
echo "${str:0:5}"              # hello  (from position 0, length 5)
```

### Indirect Expansion

```bash
var_name="PATH"
echo "${!var_name}"            # prints the value of $PATH
# ${!prefix*} lists all variables starting with prefix
echo "${!BASH*}"               # BASH BASHOPTS BASHPID BASH_VERSION ...
```

### Why This Matters for Performance

Every `$(...)` command substitution forks a child process. Every pipe creates a
subshell. In a loop processing thousands of items, the difference between parameter
expansion (runs in the current shell) and external commands (fork/exec per iteration)
can be seconds vs minutes:

```bash
# SLOW - forks sed 1000 times
for f in *.tar.gz; do
  base=$(echo "$f" | sed 's/\.tar\.gz$//')
  echo "$base"
done

# FAST - pure parameter expansion, zero forks
for f in *.tar.gz; do
  echo "${f%.tar.gz}"
done
```

> **AGENTIC GROUNDING:** Agents tend to reach for `sed`, `awk`, and `cut` for string
> operations that parameter expansion handles natively. When reviewing agent-generated
> shell, look for unnecessary subprocess spawning inside loops. The parameter expansion
> forms are not obscure tricks - they are the correct tool for in-process string
> manipulation.

---

## 4. Command Substitution and Subshells

**Estimated time: 60 minutes**

### Command Substitution

Command substitution captures the stdout of a command and inserts it as a string.

```bash
# Modern form (nestable, unambiguous)
today=$(date +%Y-%m-%d)

# Legacy form (backticks - do not use)
today=`date +%Y-%m-%d`
```

Never use backticks. The reason is nesting:

```bash
# This works:
result=$(echo "count: $(wc -l < file.txt)")

# This is a nightmare to read and easy to get wrong:
result=`echo "count: \`wc -l < file.txt\`"`
# You must backslash-escape the inner backticks
```

Command substitution captures stdout only. Stderr goes to the terminal unless you
redirect it:

```bash
# Capture stdout, stderr goes to terminal
output=$(some_command)

# Capture stdout, discard stderr
output=$(some_command 2>/dev/null)

# Capture both stdout and stderr
output=$(some_command 2>&1)

# Capture stdout, capture stderr separately
output=$(some_command 2>error.log)
```

**Trailing newlines are stripped.** This is a feature, not a bug - it makes command
substitution compose cleanly. But it can surprise you:

```bash
# printf outputs exactly "hello\n\n" (with two trailing newlines)
result=$(printf 'hello\n\n')
echo "[$result]"
# Output: [hello]
# Both trailing newlines were stripped

# If you need to preserve trailing newlines, add a sentinel character:
result=$(printf 'hello\n\n'; echo x)
result="${result%x}"
```

### Subshells

A subshell is a child process running a copy of the current shell. Created by:

- Parentheses: `(commands)`
- Pipes: `cmd1 | cmd2` (cmd2 runs in a subshell in most shells)
- Command substitution: `$(commands)`
- Background: `command &`

The critical property: **variable changes in a subshell do not propagate back to the parent.**

```bash
x=before
(x=inside; echo "in subshell: $x")
echo "in parent: $x"
# Output:
# in subshell: inside
# in parent: before
```

This is fork() semantics from Step 1. The subshell is a copy-on-write fork of the parent
process. Changes to variables in the child do not affect the parent's memory.

### The Pipeline Subshell Trap

This is the single most common shell bug related to subshells:

```bash
count=0
cat file.txt | while read -r line; do
  count=$((count + 1))
done
echo "Lines: $count"
# Output: Lines: 0
# WHY?
```

The `while` loop runs in a subshell because it is on the right side of a pipe. The
`count` variable is incremented in the subshell, but those changes are lost when the
subshell exits. The parent's `count` is still 0.

**Fix 1: Redirect from a file instead of piping (POSIX):**

```bash
count=0
while read -r line; do
  count=$((count + 1))
done < file.txt
echo "Lines: $count"
# Output: Lines: <correct count>
# No pipe, no subshell - while loop runs in the current shell
```

**Fix 2: Process substitution (bash):**

```bash
count=0
while read -r line; do
  count=$((count + 1))
done < <(some_command)
echo "Lines: $count"
# <(some_command) creates a named pipe (fd) that the while loop reads from
# The while loop runs in the current shell, not a subshell
```

**Fix 3: lastpipe (bash 4.2+):**

```bash
shopt -s lastpipe
count=0
some_command | while read -r line; do
  count=$((count + 1))
done
echo "Lines: $count"
# With lastpipe, the LAST command in a pipeline runs in the current shell
# Only works when job control is disabled (scripts, not interactive)
```

### Process Substitution

Process substitution is a bash extension that creates a temporary named pipe (a file
descriptor) for a command's output:

```bash
# diff two sorted streams without temp files
diff <(sort file1.txt) <(sort file2.txt)

# <(command) becomes a path like /dev/fd/63
echo <(echo hello)
# Output: /dev/fd/63  (or similar)

# This is a real file descriptor - you can read from it like a file
cat <(echo "I'm a virtual file")

# You can also write to a process substitution:
tee >(gzip > compressed.gz) >(wc -l > linecount.txt) < input.txt
# This sends input.txt to stdout, a gzip process, AND a wc process simultaneously
```

Process substitution connects to Step 1 directly: it uses the `pipe()` system call
to create an anonymous pipe and `dup2()` to wire it to a file descriptor. The `/dev/fd/N`
path makes the pipe look like a file, so commands that expect filename arguments work.

> **AGENTIC GROUNDING:** The pipeline subshell trap is a frequent source of bugs in
> agent-generated shell. Agents write `cat file | while read line; do total=...` and
> then reference `$total` after the loop, not realising it is always zero. When reviewing
> agent-generated loops that read from pipes and accumulate state, check whether the
> state variable is used after the pipeline. If it is, the code is broken.

> **HISTORY:** Process substitution was invented by the Korn shell (ksh88) in 1988 and
> adopted by bash. It is not in POSIX. The `/dev/fd/` filesystem originated in the 8th
> Edition of Research Unix (1985) at Bell Labs. These two features together eliminated
> an entire class of temp-file bugs.

---

## 5. Control Flow

**Estimated time: 60 minutes**

### Conditionals - Commands, Not Expressions

The `if` statement runs a command and checks its exit code:

```bash
if grep -q "error" logfile.txt; then
  echo "Errors found"
fi
```

There is no boolean type. Exit code 0 means success (true). Any non-zero exit code
means failure (false). This is backwards from most languages where 0 is false.

```bash
# These are equivalent:
if true; then echo "yes"; fi
if /bin/true; then echo "yes"; fi
# 'true' is a command that exits with 0

if false; then echo "yes"; else echo "no"; fi
# 'false' is a command that exits with 1
```

### test / [ ] - The POSIX Way

`[` is a command. `test` is the same command with a different name. They check conditions
and set the exit code:

```bash
# These are the same:
test -f /etc/passwd
[ -f /etc/passwd ]

# File tests
[ -f file ]    # file exists and is a regular file
[ -d dir ]     # directory exists
[ -e path ]    # path exists (any type)
[ -r file ]    # file is readable
[ -w file ]    # file is writable
[ -x file ]    # file is executable
[ -s file ]    # file exists and is non-empty
[ -L file ]    # file is a symlink

# String tests
[ -z "$str" ]  # string is empty (zero length)
[ -n "$str" ]  # string is non-empty
[ "$a" = "$b" ]   # strings are equal (single = in POSIX)
[ "$a" != "$b" ]  # strings are not equal

# Numeric comparison (strings that happen to be numbers)
[ "$a" -eq "$b" ]   # equal
[ "$a" -ne "$b" ]   # not equal
[ "$a" -lt "$b" ]   # less than
[ "$a" -gt "$b" ]   # greater than
[ "$a" -le "$b" ]   # less or equal
[ "$a" -ge "$b" ]   # greater or equal

# Boolean operators
[ condition1 ] && [ condition2 ]   # AND (preferred)
[ condition1 ] || [ condition2 ]   # OR (preferred)
[ ! condition ]                     # NOT
```

**Critical: always quote variables inside `[ ]`.**

```bash
name=""
# WRONG - expands to: [ = "hello" ] which is a syntax error
[ $name = "hello" ]
# bash: [: =: unary operator expected

# CORRECT - expands to: [ "" = "hello" ]
[ "$name" = "hello" ]
```

### [[ ]] - The Bash Way

`[[ ]]` is a bash keyword (not a command). It is parsed by the shell itself, which
gives it several advantages:

```bash
# No word splitting inside [[ ]] - quoting is optional (but still good practice)
name=""
[[ $name = "hello" ]]   # works fine - no word splitting

# Pattern matching with =
[[ "$file" = *.txt ]]   # true if file ends with .txt (glob pattern, not regex)

# Regex matching with =~
[[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]
echo ${BASH_REMATCH[0]}   # the full match

# Logical operators inside the brackets
[[ -f file && -r file ]]   # AND (with [ ] you need: [ -f file ] && [ -r file ])
[[ -f file || -d file ]]   # OR

# Safe with unquoted variables (but quote anyway for clarity)
unset var
[[ $var = "test" ]]   # no error
```

When to use which:

- `[ ]` for POSIX-portable scripts (Dockerfiles, `/bin/sh` scripts)
- `[[ ]]` for bash scripts where you control the runtime (project scripts, CI)

### Arithmetic

```bash
# (( )) for arithmetic evaluation (bash) - sets exit code
if (( count > 10 )); then
  echo "count is greater than 10"
fi

# $(( )) for arithmetic expansion - produces a value
result=$(( 3 + 4 * 2 ))    # 11 (standard precedence)
echo "Result: $result"

# Increment/decrement
(( count++ ))
(( count-- ))
(( count += 5 ))

# Integer division and modulo
echo $(( 17 / 5 ))   # 3
echo $(( 17 % 5 ))   # 2

# No floating point! For float math, use bc or awk:
echo "scale=2; 17 / 5" | bc    # 3.40
```

### case - Pattern Matching

More readable than chained `if/elif` for string matching:

```bash
case "$1" in
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    stop_service
    start_service
    ;;
  status|health)            # multiple patterns with |
    check_status
    ;;
  -h|--help)
    show_usage
    exit 0
    ;;
  *)                        # default case
    echo "Unknown command: $1" >&2
    show_usage
    exit 1
    ;;
esac
```

`case` uses glob patterns, not regex. Each pattern ends with `)`. Each block ends
with `;;` (or `;&` to fall through in bash 4+).

> **HISTORY:** `case/esac` is `case` spelled backwards - the ALGOL 68 block-delimiter
> convention from Steve Bourne's previous project. Same with `if/fi` and `do/done`
> (though `done` is not `do` backwards, it was chosen for readability over purity).

### Loops

**for-in loop (iterate over words):**

```bash
# Iterate over explicit values
for color in red green blue; do
  echo "$color"
done

# Iterate over glob results (safely - no need for ls)
for f in *.txt; do
  [ -f "$f" ] || continue   # guard against no matches
  echo "Processing $f"
done

# Iterate over command output (careful with quoting)
for user in $(getent passwd | cut -d: -f1); do
  echo "$user"
done
```

**C-style for loop (bash):**

```bash
for (( i = 0; i < 10; i++ )); do
  echo "Iteration $i"
done
```

**while loop:**

```bash
# Count up
i=0
while [ "$i" -lt 10 ]; do
  echo "$i"
  i=$((i + 1))
done

# Read lines from a file (POSIX, correct)
while IFS= read -r line; do
  echo "Line: $line"
done < file.txt

# Read lines from a command (bash, using process substitution)
while IFS= read -r line; do
  echo "Line: $line"
done < <(some_command)

# Infinite loop
while true; do
  check_something || break
  sleep 5
done
```

**until loop (loop while condition is false):**

```bash
# Wait for a file to appear
until [ -f /tmp/ready.flag ]; do
  sleep 1
done
echo "Ready"
```

**Loop control:**

```bash
# break - exit the loop
# continue - skip to next iteration
# break N - exit N levels of nested loops

for i in 1 2 3; do
  for j in a b c; do
    [ "$j" = "b" ] && continue  # skip b
    [ "$i" = "2" ] && break 2   # exit both loops
    echo "$i$j"
  done
done
```

### Short-circuit Evaluation

```bash
# && executes the right side only if the left succeeds
mkdir -p "$dir" && cp file "$dir/"

# || executes the right side only if the left fails
cd "$dir" || { echo "Failed to cd to $dir" >&2; exit 1; }

# Common pattern: command || die
command_that_might_fail || {
  echo "FATAL: command failed" >&2
  exit 1
}

# WARNING: do not chain && and ||  as if/else
# This is NOT the same as if/then/else:
test -f file && echo "exists" || echo "missing"
# If echo "exists" FAILS (unlikely but possible), "missing" also prints
```

---

## 6. Functions

**Estimated time: 45 minutes**

Functions in shell are commands. They participate in pipes, their exit code matters,
and they are found by name just like external commands.

### Definition

```bash
# POSIX form (portable)
my_func() {
  echo "Hello from my_func"
}

# Bash form (function keyword)
function my_func {
  echo "Hello from my_func"
}

# Both forms work in bash. Use the POSIX form for portability.
```

### Arguments

Functions do not declare parameters. Arguments are accessed positionally:

```bash
greet() {
  local name="$1"          # first argument
  local greeting="${2:-Hello}"  # second argument, default "Hello"
  echo "$greeting, $name"
}

greet "World"              # Hello, World
greet "World" "Goodbye"    # Goodbye, World
```

**Special variables inside functions (and scripts):**

```bash
show_args() {
  echo "Number of args: $#"
  echo "All args (separate words): $@"
  echo "All args (single word): $*"
  echo "First: $1, Second: $2"
  echo "Function name: ${FUNCNAME[0]}"
}

show_args one "two three" four
# Number of args: 3
# All args: one two three four
# First: one, Second: two three
```

**Critical distinction: `$@` vs `$*`:**

```bash
# "$@" preserves argument boundaries (what you almost always want)
wrapper() {
  other_command "$@"
}
wrapper "arg with spaces" "another arg"
# other_command receives TWO arguments: "arg with spaces" and "another arg"

# "$*" joins all arguments with the first character of IFS
wrapper_wrong() {
  other_command "$*"
}
wrapper_wrong "arg with spaces" "another arg"
# other_command receives ONE argument: "arg with spaces another arg"
```

### Return Values

Functions have two channels for returning data:

1. **Exit code** via `return` (0-255, 0 = success)
2. **Output** via stdout (capture with `$()`)

```bash
# Return success/failure via exit code
is_even() {
  (( $1 % 2 == 0 ))   # arithmetic evaluation sets exit code
}

if is_even 4; then
  echo "4 is even"
fi

# Return data via stdout
get_extension() {
  local file="$1"
  echo "${file##*.}"
}

ext=$(get_extension "report.tar.gz")
echo "Extension: $ext"    # Extension: gz
```

**Do not mix the two channels by accident.** If a function prints to stdout AND you
capture its output, all those prints become the "return value":

```bash
# BUG: debug output contaminates the return value
process_file() {
  echo "Processing $1..."    # This goes to stdout!
  echo "${1%.txt}.csv"       # This is the "return value"
}

result=$(process_file "data.txt")
# result is: "Processing data.txt...\ndata.csv"
# Not what you wanted

# FIX: send debug output to stderr
process_file() {
  echo "Processing $1..." >&2   # stderr - not captured by $()
  echo "${1%.txt}.csv"           # stdout - captured by $()
}
```

### Local Variables

```bash
# Without local: variables are global (they leak out of functions)
leaky() {
  x=42
}
leaky
echo "$x"   # 42 - leaked from the function

# With local: variables are scoped to the function
contained() {
  local x=42
}
contained
echo "$x"   # empty - x was local to the function
```

`local` is a bash extension (but supported by dash and most sh implementations in
practice). In strict POSIX, there is no local scoping - all variables are global.

### Functions as Commands

Functions are commands. Everything that works with commands works with functions:

```bash
# Pipe to/from functions
upper() {
  tr '[:lower:]' '[:upper:]'
}
echo "hello" | upper    # HELLO

# Use in conditionals
has_root() {
  [ "$(id -u)" -eq 0 ]
}
if has_root; then echo "Running as root"; fi

# Override commands (use with caution)
cd() {
  builtin cd "$@" && echo "Now in: $PWD"
}
```

> **AGENTIC GROUNDING:** Agents generate functions with global variables, missing
> `local` declarations, debug output on stdout (contaminating captured return values),
> and inconsistent use of `"$@"` vs `$@`. When reviewing agent-generated shell functions,
> check: are variables declared local? Is debug output on stderr? Are arguments quoted?
> Is `"$@"` used to pass arguments through?

---

## 7. Error Handling

**Estimated time: 60 minutes**

Shell scripts are silent about errors by default. A command fails, the script continues
to the next line. This is the source of cascading failures in CI pipelines, deployment
scripts, and agent-generated automation.

### The Defensive Header

```bash
#!/bin/bash
set -euo pipefail
```

This is three separate settings. Know what each does - and what it does NOT do.

### set -e (Exit on Error)

When `-e` is set, the script exits immediately when a command returns a non-zero exit
code.

```bash
set -e
mkdir /nonexistent/path    # fails, script exits here
echo "This never runs"
```

**What `-e` does NOT catch:**

```bash
set -e

# Commands in conditionals are exempt
if bad_command; then     # bad_command fails, but -e doesn't trigger
  echo "this runs if bad_command succeeds"
fi

# Commands before && or || are exempt
bad_command && echo "ok"   # bad_command fails, script continues
bad_command || echo "failed"  # bad_command fails, script continues

# Commands in the test position of while/until are exempt
while bad_command; do    # bad_command fails, loop exits normally
  break
done

# Negated commands are exempt
! bad_command   # exit code is inverted, -e sees 0

# Commands in command substitution may or may not trigger -e
# This depends on the shell version and is unreliable
result=$(bad_command)   # behaviour varies!
```

**The compound command trap:**

```bash
set -e

# This exits on failure (single command)
false

# This does NOT exit on failure (false is tested as part of a conditional)
if false; then echo "yes"; fi   # -e is suppressed in if/while conditions

# This also survives (short-circuit is an errexit exemption)
false || true    # false fails, but || makes it part of a conditional chain

# But this DOES exit (semicolon list is NOT an exemption)
false; true      # bash exits at false - a ; list is sequential, not conditional
```

The rule: `set -e` is a safety net, not a guarantee. It catches gross errors. It does
not catch errors in conditionals, short-circuit expressions, or pipelines (without
`pipefail`).

### set -u (Error on Unset Variables)

```bash
set -u
echo "$undefined_variable"
# bash: undefined_variable: unbound variable

# Use ${var:-default} to safely handle potentially unset variables:
echo "${undefined_variable:-default value}"    # no error
```

This catches typos in variable names. Without `-u`, `$UNDEFNIED_VAR` silently expands
to an empty string.

### set -o pipefail

By default, a pipeline's exit code is the exit code of the LAST command:

```bash
false | true
echo $?    # 0 - pipeline "succeeded" even though false failed

set -o pipefail
false | true
echo $?    # 1 - pipeline fails because false failed
```

With `pipefail`, the pipeline's exit code is the exit code of the rightmost command
that failed. Combined with `set -e`, this means `bad_command | good_command` will
cause the script to exit.

### trap - Cleanup on Exit

`trap` registers a command to run when the shell receives a signal or exits:

```bash
#!/bin/bash
set -euo pipefail

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT    # runs on ANY exit (0, error, signal)

# Use $tmpdir freely - it will be cleaned up no matter how the script exits
cp important_file "$tmpdir/"
process_stuff "$tmpdir/"
# If process_stuff fails, the trap still fires and cleans up
```

**Common trap signals:**

```bash
trap 'cleanup_function' EXIT      # any exit
trap 'echo "Interrupted" >&2; exit 130' INT   # Ctrl-C
trap 'echo "Terminated" >&2; exit 143' TERM   # kill
trap '' HUP                       # ignore hangup (for daemons)
```

The `EXIT` trap is the most useful. It fires on normal exit, on `exit N`, on `set -e`
triggered exit, and on most signals. It is the shell equivalent of a `finally` block
or a Go `defer`.

**The ERR trap (bash):**

```bash
trap 'echo "Error on line $LINENO" >&2' ERR
```

The ERR trap fires when a command fails (similar to `set -e` conditions). But it has the
same exemptions as `set -e` - it does not fire in conditionals, after `&&` or `||`, etc.
It is also a bash extension, not POSIX. Use it for debugging, but do not rely on it for
correctness.

### Putting It All Together - The Defensive Template

```bash
#!/bin/bash
set -euo pipefail

# Cleanup on exit
cleanup() {
  local exit_code=$?
  # Cleanup commands here
  rm -rf "${tmpdir:-}"
  exit "$exit_code"
}
trap cleanup EXIT

# Usage
usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") [options] <argument>

Options:
  -v    Verbose output
  -h    Show this help
EOF
}

# Argument parsing
verbose=false
while getopts ":vh" opt; do
  case "$opt" in
    v) verbose=true ;;
    h) usage; exit 0 ;;
    :) echo "Error: -$OPTARG requires an argument" >&2; exit 1 ;;
    *) echo "Error: unknown option -$OPTARG" >&2; usage; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

# Require positional argument
: "${1:?Error: argument required. Use -h for help.}"

# Main logic here
tmpdir=$(mktemp -d)
echo "Working in $tmpdir"
```

> **AGENTIC GROUNDING:** Agents almost never generate `set -euo pipefail` unless
> explicitly prompted. They write scripts where failures cascade silently. The most
> dangerous pattern: a CI pipeline step that runs a series of commands without error
> handling. The first command fails silently, subsequent commands operate on stale or
> missing data, and the pipeline reports success because the last command (often an echo)
> returns 0. Every agent-generated script should be checked for this header.

---

## 8. POSIX sh vs Bash

**Estimated time: 45 minutes**

### What is POSIX sh?

POSIX (Portable Operating System Interface) defines a shell language standard. Any
compliant shell implements this standard: bash (in POSIX mode), dash, ash, busybox sh,
ksh, zsh (in emulation mode).

`/bin/sh` is NOT necessarily bash. On Debian/Ubuntu, `/bin/sh` is dash (a minimal POSIX
shell). On Arch, `/bin/sh` is bash. On Alpine (Docker), `/bin/sh` is busybox ash.

```bash
# Check what /bin/sh actually is
ls -la /bin/sh
# Debian: /bin/sh -> dash
# Arch:   /bin/sh -> bash
# Alpine: /bin/sh -> /bin/busybox

# Check bash version
bash --version
```

### What POSIX sh Does Not Have

If your script's shebang is `#!/bin/sh`, you cannot use any of these:

| Feature | POSIX sh | Bash |
|---------|----------|------|
| `[[ ]]` keyword test | No | Yes |
| Arrays | No | Yes |
| Associative arrays | No | Yes (4.0+) |
| `${var//pat/rep}` replace-all | No | Yes |
| `<(process substitution)` | No | Yes |
| `<<<` here strings | No | Yes |
| `{1..10}` brace expansion | No | Yes |
| `(( ))` arithmetic | No | Yes |
| `&>` redirect stdout+stderr | No | Yes |
| `function` keyword | No | Yes |
| `local` keyword | No | Yes (but dash has it) |
| `select` menu loop | No | Yes |
| `BASH_REMATCH` regex | No | Yes |
| `set -o pipefail` | No | Yes |

### When to Use POSIX sh

- **Dockerfiles** - `RUN` commands execute with `/bin/sh` by default. In Alpine-based
  images, that is ash/busybox. Bash may not be installed.
- **System init scripts** - `/etc/init.d/` scripts should be POSIX for portability.
- **Any script that might run on different systems** - if you cannot guarantee bash
  is installed, write POSIX sh.

```dockerfile
# This works in Alpine (busybox sh):
RUN if [ -f /etc/config ]; then cp /etc/config /etc/config.bak; fi

# This FAILS in Alpine (no [[ ]] in busybox):
RUN if [[ -f /etc/config ]]; then cp /etc/config /etc/config.bak; fi
```

### When to Use Bash

- Project scripts where you control the runtime environment
- CI pipelines where you specify the shell
- Interactive shell scripts

The project's Makefile declares `SHELL := /bin/bash`, which means all make recipes
run in bash. This is intentional - it enables `set -o pipefail` and other bash features
in recipes.

### Writing POSIX sh

```bash
#!/bin/sh
# POSIX equivalent of bash features:

# Instead of [[ ]], use [ ] with quoting
if [ -f "$file" ] && [ -r "$file" ]; then
  echo "File exists and is readable"
fi

# Instead of (( )), use $(( )) for arithmetic
i=0
while [ "$i" -lt 10 ]; do
  i=$((i + 1))
done

# Instead of arrays, use positional parameters
set -- one two three
for item; do    # implicitly iterates over "$@"
  echo "$item"
done

# Instead of ${var//pat/rep}, use sed
cleaned=$(echo "$input" | sed 's/old/new/g')

# Instead of <<<, use echo | or here-doc
echo "$string" | while read -r line; do echo "$line"; done

# Instead of <(), use temp files or named pipes
mkfifo /tmp/pipe.$$
sort file1 > /tmp/pipe.$$ &
diff /tmp/pipe.$$ <(sort file2)  # ... you can't do this in POSIX
# In POSIX, you use temp files:
sort file1 > /tmp/sorted1.$$
sort file2 > /tmp/sorted2.$$
diff /tmp/sorted1.$$ /tmp/sorted2.$$
rm /tmp/sorted1.$$ /tmp/sorted2.$$
```

### The Shebang Line

The first line of a script tells the kernel which interpreter to use:

```bash
#!/bin/bash       # Use bash specifically
#!/bin/sh         # Use the system POSIX shell (might be dash, ash, bash)
#!/usr/bin/env bash   # Find bash in $PATH (more portable across systems)
```

`#!/usr/bin/env bash` is preferred for project scripts because bash may be in different
locations on different systems (`/bin/bash`, `/usr/bin/bash`, `/usr/local/bin/bash` on
macOS with Homebrew).

> **AGENTIC GROUNDING:** Agents do not distinguish between POSIX sh and bash when
> generating scripts. They write bash syntax in `#!/bin/sh` scripts. They put `[[ ]]`
> in Dockerfiles that use Alpine. When reviewing agent-generated Dockerfiles, check
> the base image (Alpine = ash, Ubuntu/Debian = dash for sh) and verify the shell
> commands are compatible. When reviewing agent-generated scripts, check the shebang
> matches the syntax used.

> **HISTORY:** Bash (1989) was written by Brian Fox for the GNU Project as a free
> software replacement for the Bourne shell. The name stands for "Bourne Again Shell."
> The POSIX standard (IEEE 1003.2) was published in 1992, codifying a common subset of
> sh behaviour. The dash shell (Debian Almquist Shell) was adopted by Debian as `/bin/sh`
> in 2006 for performance - dash is 4x faster than bash for script interpretation because
> it does not load bash's extensive feature set. This is why Dockerfiles that work on
> your laptop (where `/bin/sh` is bash) can break in production (where `/bin/sh` is dash).

---

## 9. Here Documents and Here Strings

**Estimated time: 30 minutes**

### Here Documents

A here-document provides multi-line input to a command without a temp file:

```bash
# Basic here-doc - variable expansion happens
cat <<EOF
Hello, $USER
Today is $(date +%A)
Your home is $HOME
EOF

# Quoted delimiter - NO expansion
cat <<'EOF'
This is literal: $USER
No expansion: $(date)
Backslashes are literal: \n \t \\
EOF

# Indented here-doc (<<- strips leading TABS, not spaces)
if true; then
	cat <<-EOF
	This is indented with tabs
	Tabs are stripped from the output
	EOF
fi
```

**Practical uses:**

```bash
# Write a config file from a script
cat > /etc/myapp/config.yaml <<EOF
database:
  host: ${DB_HOST:?DB_HOST required}
  port: ${DB_PORT:-5432}
  name: ${DB_NAME:-myapp}
EOF

# Feed SQL to a database client
psql "$DATABASE_URL" <<'EOF'
SELECT count(*) FROM users
WHERE created_at > NOW() - INTERVAL '7 days';
EOF

# Multi-line string in a variable
read -r -d '' usage <<'EOF' || true
Usage: mycommand [options]

Options:
  -v    Verbose
  -h    Help
EOF
echo "$usage"
# Note: || true is needed because read returns non-zero at EOF with -d ''
```

### Here Strings (Bash Extension)

A here-string feeds a string as stdin to a command:

```bash
# Instead of: echo "$string" | command
# Use: command <<< "$string"

# Count words in a variable
wc -w <<< "$message"

# Parse a CSV field
IFS=, read -r name age city <<< "Alice,30,London"

# Feed to bc for math
bc <<< "scale=2; 22 / 7"
```

Here strings are a bash extension. In POSIX sh, use `echo "$string" | command` or a
one-line here-document instead.

### Here Documents in Makefiles

In a Makefile context, here-documents interact with make's recipe processing. Each line
of a recipe is normally a separate shell invocation. The `.ONESHELL:` directive (used
in this project's Makefile) changes this so the entire recipe runs in one shell.

Without `.ONESHELL`, here-documents in Makefiles require the `define/endef` construct
or continuation backslashes.

> **AGENTIC GROUNDING:** Agents frequently use here-documents in GitHub Actions
> workflows for creating multi-line files, generating configs, and feeding input to
> commands. The most common bug: using `<<EOF` (with expansion) when `<<'EOF'` (without
> expansion) was intended, causing `$VARIABLE` references in the content to be expanded
> by the shell. In CI contexts where environment variables are set, this silently
> injects unexpected values. Always check the delimiter quoting.

---

## Challenges

The challenges below are designed to build and verify the skills from this step. They
escalate from targeted drills to full-context analysis of production code.

---

## Challenge: Quoting Gauntlet

**Estimated time: 30 minutes**

Create files with adversarial names and write scripts that correctly handle them.

### Setup

```bash
mkdir -p /tmp/quoting-gauntlet && cd /tmp/quoting-gauntlet

# Create files with adversarial names
touch "normal.txt"
touch "has spaces.txt"
touch "has  double  spaces.txt"
touch 'has "quotes".txt'
touch "has 'single quotes'.txt"
touch $'has\nnewline.txt'          # actual newline in filename
touch "has * glob.txt"
touch -- "-starts-with-dash.txt"   # -- prevents - being read as an option
touch $'has\ttab.txt'
```

### Tasks

1. Write a script that lists all `.txt` files in the directory, one per line, handling
   all adversarial names correctly. Demonstrate that `for f in $(ls *.txt)` fails and
   explain exactly why, referencing the evaluation order from Section 2.

2. Write a script that copies all files to a backup directory, preserving the exact
   filenames. Test with each adversarial name.

3. Write a script that counts the number of lines in each file (they are all empty, so
   the count should be 0 for all). Show the failure mode when files are not quoted.

4. Write a one-liner that deletes the file starting with a dash. Explain why `rm -starts-with-dash.txt` fails.

### Expected Learning

You should be able to explain:
- Why `for f in *.txt` works but `for f in $(ls *.txt)` breaks
- Why glob expansion is safe (it produces correctly-delimited arguments) but command
  substitution output is subject to word splitting
- Why `rm -- "-starts-with-dash.txt"` works (end-of-options marker)
- Why `find -print0 | xargs -0` exists

---

## Challenge: Parameter Expansion Workout

**Estimated time: 30 minutes**

Given the following file paths, extract the requested components using ONLY parameter
expansion. No `dirname`, `basename`, `sed`, `awk`, `cut`, or any external commands.

```bash
# Input paths
p1="/home/user/projects/myapp/src/main.rs"
p2="archive.tar.gz"
p3="/var/log/nginx/access.log.2024-01-15.gz"
p4="./relative/path/to/file"
p5="/no-extension"
```

### Tasks

For each path, extract:
1. The directory (equivalent to `dirname`)
2. The filename (equivalent to `basename`)
3. The extension (just the last one, e.g., `gz` not `tar.gz`)
4. The full extension (e.g., `tar.gz` for `p2`)
5. The filename without any extension
6. The filename with the extension changed to `.bak`

### Bonus

Write a function `path_components()` that takes a path and prints directory, name,
and extension on separate lines, using only parameter expansion. Handle edge cases:
no extension, no directory, multiple extensions, trailing slash.

---

## Challenge: Pipeline Pitfalls

**Estimated time: 30 minutes**

### The Bug

```bash
#!/bin/bash
total=0
cat /etc/passwd | while IFS=: read -r user _ uid _; do
  if [ "$uid" -ge 1000 ] 2>/dev/null; then
    total=$((total + 1))
  fi
done
echo "Users with UID >= 1000: $total"
```

### Tasks

1. Run this script. Observe that it prints 0. Explain exactly why, tracing the process
   tree (which processes are created, which variable is in which process).

2. Fix it using input redirection (POSIX compatible).

3. Fix it using process substitution (bash).

4. Fix it using `lastpipe` (bash 4.2+).

5. Fix it by restructuring to avoid the problem entirely (move the `echo` inside the
   subshell).

6. For each fix, explain the tradeoffs: portability, readability, correctness.

---

## Challenge: Defensive Script Template

**Estimated time: 45 minutes**

Write a production-grade bash script template that includes:

1. Shebang line with `#!/usr/bin/env bash`
2. `set -euo pipefail`
3. A `cleanup` function registered with `trap ... EXIT`
4. A `usage` function that prints to stderr
5. Argument parsing with `getopts` supporting `-v` (verbose), `-o <file>` (output file),
   and `-h` (help)
6. Required positional argument validation using `${1:?}`
7. A `log` function that prints timestamped messages to stderr, and only in verbose mode
8. A `die` function that prints an error message and exits with a given code
9. Temporary directory creation and cleanup
10. Proper exit codes (0 success, 1 user error, 2 system error)

The script should process an input file (the positional argument) and write results to
the output file (defaulting to stdout). The actual processing can be trivial - the
template is the point.

### Verification

- Run with no arguments: should print usage and exit 1
- Run with `-h`: should print usage and exit 0
- Run with a nonexistent file: should print an error and exit 2
- Kill with Ctrl-C mid-execution: should clean up temp directory
- Run with `bash -n script.sh`: should pass syntax check
- Run with `shellcheck script.sh`: should pass with no warnings

---

## Challenge: Parse the POLECAT Wrapper

**Estimated time: 45 minutes**

This is the POLECAT wrapper from the project's Makefile (`Makefile:50-74`):

```make
define POLECAT
	@TASK=$$(basename $(1) .md); \
	echo ">>> polecat $$TASK -- streaming to $(LOGS)/$$TASK.log"; \
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
		echo "ERROR: polecat $$TASK produced no delta -- noop detected"; exit 1; \
	fi
endef
```

### Tasks

Annotate every line. For each line, answer:

1. **What does it do?** Plain English.
2. **Why `$$` instead of `$`?** Make processes recipes through its own variable expansion
   first, where `$` is make's variable sigil. `$$` escapes to a literal `$` in the
   shell command. What would happen if you wrote `$TASK` instead of `$$TASK`?
3. **Why `$(1)` with one `$`?** This IS a make variable (the first argument to the
   `POLECAT` macro), not a shell variable. Make expands it before the shell sees it.
4. **What does `@` at the start do?** Suppresses make echoing the command.
5. **What does `\` at line end do?** Continues to the next line. With `.ONESHELL:`,
   the entire recipe is one shell invocation, but the `define` block still uses
   continuation for the make parser.
6. **What does `timeout 300 command` do at the process level?** (Connect to Step 1:
    timeout forks the command as a child, starts a timer, sends SIGTERM after 300s.
    It does NOT automatically send SIGKILL - that requires the `-k` flag, e.g.
    `timeout -k 10 300 command`. Exit code 124 means the timeout fired.)
7. **What is the delta detection doing?** It captures git state before and after the
   polecat run. If HEAD, diff stat, and untracked files are all identical, the polecat
   produced no changes and it is treated as a failure.
8. **Why pipe through `tee`?** To stream output to the terminal (for observation) AND
   capture it to a log file simultaneously.
9. **What is `$$(cat $(1))`?** Make expands `$(1)` to the plan filename. Then the shell
   runs `cat <filename>` and substitutes its output. The plan file contents become the
   `-p` argument to claude.

### Bonus

1. Identify what would break if `.ONESHELL:` were removed from the Makefile. (Hint: each
   line would be a separate shell invocation, and variables set on one line would not be
   available on the next.)

2. There is a real bug in this wrapper. `EXIT_CODE=$$?` captures the exit code of `tee`,
   not `timeout`, because `$?` returns the exit code of the last command in a pipeline.
   Without `set -o pipefail`, the timeout exit code (124) is lost if `tee` succeeds.
   What would you need to change to fix this?

---

## Challenge: Shell Gotcha Quiz

**Estimated time: 45 minutes**

Each snippet looks correct but contains a bug. Identify the bug, explain the failure
mode, and provide the fix. Classify each bug by which section of this step it relates to.

### Gotcha 1

```bash
#!/bin/bash
set -e
count=$(grep -c "error" /var/log/syslog)
echo "Found $count errors"
```

**Hint:** What is the exit code of `grep -c` when there are zero matches?

### Gotcha 2

```bash
#!/bin/bash
dir="/tmp/my app/data"
mkdir -p $dir
```

**Hint:** How many directories does this create?

### Gotcha 3

```bash
#!/bin/bash
read -p "Enter filename: " file
if [ -f $file ]; then
  echo "File exists"
fi
```

**Hint:** What happens when the user enters nothing (presses Enter)?

### Gotcha 4

```bash
#!/bin/bash
for f in $(find . -name "*.bak" -type f); do
  rm "$f"
done
```

**Hint:** Works fine until a filename contains a space. What do `-exec` and `-print0` solve?

### Gotcha 5

```bash
#!/bin/bash
result=""
echo -e "line1\nline2\nline3" | while read -r line; do
  result="${result}${line},"
done
echo "Result: $result"
```

**Hint:** Section 4. The pipe creates a subshell.

### Gotcha 6

```bash
#!/bin/sh
if [[ -f /etc/config ]]; then
  source /etc/config
fi
```

**Hint:** Section 8. What is `/bin/sh` on Debian? On Alpine?

### Gotcha 7

```bash
#!/bin/bash
url="https://example.com/api?foo=bar&baz=qux"
curl $url
```

**Hint:** The quoting problem. Without quotes, `$url` is subject to word splitting
(spaces would break it) and glob expansion (`?` is a glob character that matches any
single character in filenames). Quote it: `curl "$url"`.

### Gotcha 8

```bash
#!/bin/bash
set -euo pipefail
files=$(ls *.txt 2>/dev/null)
if [ -z "$files" ]; then
  echo "No txt files"
  exit 0
fi
```

**Hint:** What does `set -e` do when `ls *.txt` fails (no .txt files)?

### Gotcha 9

```bash
#!/bin/bash
total=0
for n in $(seq 1 1000); do
  result=$(echo "scale=2; $n / 7" | bc)
  total=$(echo "$total + $result" | bc)
done
echo "Total: $total"
```

**Hint:** Not a correctness bug - a performance bug. How many processes does this spawn?

### Gotcha 10

```bash
#!/bin/bash
password=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "Generated password: $password"
```

**Hint:** `set -o pipefail` would kill this. Why? What does `head` do when it has enough
bytes?

---

## Quick Reference: Shell Evaluation Order

For quick lookup. Memorise this order - it explains most shell bugs.

```
1. Brace expansion         {a,b}      -> a b
2. Tilde expansion         ~          -> /home/user
3. Parameter expansion     $var       -> value
4. Command substitution    $(cmd)     -> output
5. Arithmetic expansion    $((1+2))   -> 3
6. Word splitting          value      -> val ue  (if IFS contains space between l and u)
7. Pathname expansion      *.txt      -> a.txt b.txt c.txt
8. Quote removal           "hello"    -> hello
```

Steps 6 and 7 are where bugs live. Double quotes suppress both.

---

## Quick Reference: Parameter Expansion

```bash
${var}              # basic expansion
${var:-default}     # default if unset/empty
${var:=default}     # assign default if unset/empty
${var:?error}       # error if unset/empty
${var:+alternate}   # alternate if set and non-null
${var#pattern}      # strip shortest prefix
${var##pattern}     # strip longest prefix
${var%pattern}      # strip shortest suffix
${var%%pattern}     # strip longest suffix
${var/pat/rep}      # replace first match
${var//pat/rep}     # replace all matches
${var/#pat/rep}     # replace prefix
${var/%pat/rep}     # replace suffix
${#var}             # length
${var:offset:len}   # substring (bash)
${!prefix*}         # variable names matching prefix (bash)
```

---

## Quick Reference: Defensive Header

```bash
#!/usr/bin/env bash
set -euo pipefail

# set -e    Exit on error (with exemptions for conditionals/&&/||)
# set -u    Error on unset variable
# set -o pipefail   Pipeline fails if ANY command fails

trap 'cleanup' EXIT
```

---

## What to Read Next

**[Step 3: The Filesystem as State](/bootcamp/03-filesystem-as-state/)**

You now understand how the shell launches processes (Step 1) and how to compose those
processes using the shell language (this step). Step 3 covers the other half of the Unix
model: the filesystem. In Unix, nearly everything is a file - regular files, directories,
devices, pipes, sockets, `/proc`, `/sys`. Understanding the filesystem as a stateful
namespace is essential for:

- Understanding how configuration works (`/etc`, dotfiles, environment)
- Reading process state through `/proc/<pid>/`
- Understanding permissions, ownership, and capability models
- Working with container overlay filesystems
- Diagnosing "file not found" errors that are actually permission or mount issues

The shell and the filesystem are the two halves of the Unix interface. After Step 3,
you will have the complete foundation.

> **HISTORY:** The Shellshock vulnerability (CVE-2014-6271), disclosed in September 2014,
> was a bug in bash's function export mechanism that had existed since bash 1.03 (1989) -
> 25 years undetected. The bug was in how bash parsed environment variables that contained
> function definitions: it continued executing code after the function definition ended.
> An attacker could inject arbitrary commands into environment variables that would be
> executed when bash started. This affected every CGI web server, SSH forced-command
> system, and DHCP client that used bash. The lesson: the shell's apparent simplicity
> conceals deep complexity. Surface-level understanding is insufficient for security work.
> Shellshock was not a clever exploit of an obscure feature - it was a fundamental parsing
> error in the most widely deployed shell on Earth, hiding in plain sight for a quarter
> century.
