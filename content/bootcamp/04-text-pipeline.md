+++
title = "The Text Processing Pipeline - grep, sed, awk, jq, yq"
date = "2026-03-10"
description = "The tools that transform text streams: jq, grep, awk, sed, yq, and the supporting cast that make Unix pipelines practical."
tags = ["jq", "grep", "awk", "sed", "yq", "text-processing", "pipelines", "bootcamp"]
step = 4
tier = 1
estimate = "6-8 hours"
bootcamp = 1
+++

Step 4 of 12 in the Agentic Engineering Bootcamp.

---

## Why This Step Exists

Step 1 gave you processes. Step 2 gave you the shell to compose them. Step 3 gave you
the filesystem as state. Now you learn the VERBS - the tools that transform text streams.

The taxonomy analysis found that 75% of software categories reduce to data transformation.
A web server transforms an HTTP request into a response. A compiler transforms source into
machine code. A database transforms a query into a result set. At the Unix level, this
pattern becomes: text in, transform, text out. The tools in this step handle the majority
of text-to-text transformation.

Without these tools, pipes are plumbing with no fixtures. With them, you can query, filter,
transform, and reshape any text data flowing through the system.

> **AGENTIC GROUNDING:** When an agent generates structured output - JSON API responses,
> YAML configs, log files, CSV reports - these are the tools that let you verify, query,
> and transform that output. An agent claiming "I updated the config" is unverified until
> you run `yq '.key' config.yaml` and see the value. An agent producing metrics is opaque
> until you can pipe its output through `jq` and extract what matters. These tools are
> your verification instruments.

---

## Part 1: jq - The JSON Surgeon

**Estimated time: 1.5-2 hours**

We start with jq because JSON is the lingua franca of APIs, and jq's functional pipeline
model teaches the same thinking that makes the rest of this step click. jq has its own
pipe operator - you will write pipelines inside pipelines.

> **HISTORY:** jq was created by Stephen Dolan in 2012. It brought the Unix pipeline
> philosophy to structured data. Before jq, parsing JSON from the shell meant Python
> one-liners or fragile grep/sed hacks that broke on nested structures. jq made JSON
> a first-class citizen of the Unix pipeline.

### 1.1 First Contact - The Identity Filter

The simplest jq program is `.` - the identity filter. It reads JSON, pretty-prints it,
and outputs it unchanged.

```bash
# Raw JSON from an API is usually a single long line
printf '{"name":"alice","age":30,"active":true}' | jq '.'
```

Output:
```json
{
  "name": "alice",
  "age": 30,
  "active": true
}
```

This is already useful. APIs return minified JSON. `.` is your pretty-printer.

### 1.2 Field Access

Dot notation extracts fields. This is the operation you will use most.

```bash
# Single field
printf '{"name":"alice","age":30}' | jq '.name'
# Output: "alice"

# Nested field
printf '{"user":{"name":"alice","address":{"city":"London"}}}' | jq '.user.address.city'
# Output: "London"

# Array element by index
printf '{"items":["a","b","c"]}' | jq '.items[0]'
# Output: "a"

# Last element
printf '{"items":["a","b","c"]}' | jq '.items[-1]'
# Output: "c"
```

### 1.3 The jq Pipe - Pipelines Inside Pipelines

jq has its own `|` operator that works like the shell pipe but inside a single jq
expression. This is the key insight: jq programs are pipelines of filters.

```bash
# Array iteration + field access
printf '{"users":[{"name":"alice","age":30},{"name":"bob","age":25}]}' \
  | jq '.users[] | .name'
# Output:
# "alice"
# "bob"
```

`.users[]` iterates the array (producing one output per element), then `| .name` extracts
the name from each. The `[]` without an index is the iterator - it explodes an array into
individual elements.

```bash
# Chain multiple operations
printf '{"data":{"users":[{"name":"alice","role":"admin"},{"name":"bob","role":"user"}]}}' \
  | jq '.data.users[] | .role'
# Output:
# "admin"
# "user"
```

### 1.4 Raw Output and Shell Integration

By default, jq outputs JSON strings with quotes. When you need bare strings for shell
consumption, use `-r` (raw output).

```bash
# With quotes (default) - bad for shell
printf '{"name":"alice"}' | jq '.name'
# Output: "alice"

# Without quotes (-r) - good for shell
printf '{"name":"alice"}' | jq -r '.name'
# Output: alice

# Using jq output in a shell loop
printf '[{"host":"a.example.com"},{"host":"b.example.com"}]' \
  | jq -r '.[].host' \
  | while read -r host; do
      printf "Pinging %s\n" "$host"
    done
```

### 1.5 Filtering with select

`select()` keeps elements that match a condition and drops the rest. This is your WHERE
clause.

```bash
# Filter users by age
printf '[{"name":"alice","age":30},{"name":"bob","age":25},{"name":"carol","age":35}]' \
  | jq '.[] | select(.age > 28)'
# Output:
# {"name":"alice","age":30}
# {"name":"carol","age":35}

# Filter by string match
printf '[{"name":"api-server","status":"running"},{"name":"worker","status":"stopped"}]' \
  | jq '.[] | select(.status == "running") | .name'
# Output: "api-server"

# Combine conditions
printf '[{"name":"a","priority":"high","done":false},{"name":"b","priority":"high","done":true},{"name":"c","priority":"low","done":false}]' \
  | jq '.[] | select(.priority == "high" and .done == false) | .name'
# Output: "a"
```

### 1.6 Constructing New Objects

You can reshape JSON by constructing new objects and arrays.

```bash
# Rename fields
printf '{"first_name":"alice","birth_year":1994}' \
  | jq '{name: .first_name, age: (2026 - .birth_year)}'
# Output: {"name":"alice","age":32}

# Build an array from iteration
printf '{"users":[{"name":"alice","role":"admin"},{"name":"bob","role":"user"}]}' \
  | jq '[.users[] | {who: .name, is: .role}]'
# Output: [{"who":"alice","is":"admin"},{"who":"bob","is":"user"}]
```

Note the outer `[]` wrapping - without it you get multiple separate JSON objects; with it
you get a single JSON array.

### 1.7 map, add, and Aggregation

```bash
# Sum prices
printf '[{"item":"a","price":10},{"item":"b","price":20},{"item":"c","price":15}]' \
  | jq '[.[].price] | add'
# Output: 45

# map is shorthand for [.[] | expr]
printf '[1,2,3,4,5]' | jq 'map(. * 2)'
# Output: [2,4,6,8,10]

# Count elements
printf '[{"s":"open"},{"s":"closed"},{"s":"open"},{"s":"open"}]' \
  | jq '[.[] | select(.s == "open")] | length'
# Output: 3

# Group and count (the SQL GROUP BY equivalent)
printf '[{"s":"open"},{"s":"closed"},{"s":"open"},{"s":"open"}]' \
  | jq 'group_by(.s) | map({status: .[0].s, count: length})'
# Output: [{"status":"closed","count":1},{"status":"open","count":3}]
```

### 1.8 String Interpolation

jq can construct strings from data using `\()` interpolation inside strings.

```bash
printf '[{"name":"alice","score":95},{"name":"bob","score":87}]' \
  | jq -r '.[] | "\(.name) scored \(.score)%"'
# Output:
# alice scored 95%
# bob scored 87%
```

### 1.9 Passing Shell Variables into jq

Never interpolate shell variables into jq expressions by string concatenation. It breaks
on special characters and invites injection. Use `--arg`.

```bash
# WRONG - breaks on special characters, injection risk
status="open"
jq ".[] | select(.s == \"$status\")" file.json

# RIGHT - --arg creates a jq variable
status="open"
jq --arg s "$status" '.[] | select(.s == $s)' file.json
```

`--arg` always passes strings. For numeric values, use `--argjson`:

```bash
min_age=25
printf '[{"name":"alice","age":30},{"name":"bob","age":20}]' \
  | jq --argjson min "$min_age" '.[] | select(.age >= $min)'
```

### 1.10 Conditionals and the try Operator

```bash
# if-then-else
printf '[{"name":"alice","role":"admin"},{"name":"bob","role":"user"}]' \
  | jq -r '.[] | if .role == "admin" then "\(.name) (ADMIN)" else .name end'
# Output:
# alice (ADMIN)
# bob

# The ? operator suppresses errors on missing fields
printf '{"a":1}' | jq '.b.c?'
# Output: null (instead of error)

# try-catch
printf '{"data":"not-a-number"}' \
  | jq 'try (.data | tonumber) catch "parse failed"'
# Output: "parse failed"
```

### 1.11 Slurp Mode

By default, jq processes each JSON object in the input independently. `--slurp` (`-s`)
reads all inputs into a single array.

```bash
# Without slurp - processes each line independently
printf '{"n":1}\n{"n":2}\n{"n":3}\n' | jq '.n'
# Output: 1 2 3 (three separate outputs)

# With slurp - all inputs become one array
printf '{"n":1}\n{"n":2}\n{"n":3}\n' | jq -s '[.[].n] | add'
# Output: 6
```

This is critical when processing line-delimited JSON (JSONL), which is common in log
files and streaming APIs.

### 1.12 Real-World jq - Parsing the GitHub API

```bash
# Get the 5 most recent issues from a GitHub repo
gh api repos/anthropics/courses/issues --paginate \
  | jq -r '.[] | "\(.number)\t\(.state)\t\(.title[:60])"' \
  | head -5

# Get all open PRs with their review status
gh api repos/owner/repo/pulls?state=open \
  | jq -r '.[] | "\(.number)\t\(.user.login)\t\(.title[:50])\t\(.draft)"'

# Extract just the filenames from a git diff (JSON output)
gh api repos/owner/repo/pulls/42/files \
  | jq -r '.[].filename'
```

> **AGENTIC GROUNDING:** The project's `bin/triangulate` script parses structured YAML
> review findings from multiple AI models, matches them by similarity, and computes
> convergence metrics. The output is YAML, consumable by `yq`. When you need to quickly
> inspect triangulation results - "which findings did all three models agree on?" - jq
> and yq let you query the output directly without running the full Python script. For
> example: `yq '.[] | select(.convergence_count >= 3) | .title' findings-union.yaml`

---

## Part 2: grep and Regular Expressions - The Universal Search

**Estimated time: 1-1.5 hours**

grep is the most-used command in this step. You will use it more than any other tool here
because search is the most common text operation. Before you transform data, you have to
find it.

> **HISTORY:** Ken Thompson wrote grep in 1974. The name comes from the ed editor command
> `g/re/p` - "globally search for a regular expression and print matching lines." When
> Thompson's colleagues at Bell Labs asked for a standalone tool to search files, he
> extracted the regex engine from ed and built grep overnight. Regular expressions
> themselves were invented by mathematician Stephen Kleene in 1956 as a formal notation
> for describing patterns in language theory. Thompson implemented Kleene's mathematics in
> the QED editor (1968), then ed, then grep. From abstract algebra to the most practical
> text processing tool in computing - in under 20 years.

### 2.1 Basic grep

```bash
# Search for a pattern in a file
grep "error" /var/log/syslog

# Search recursively in a directory
grep -r "TODO" src/

# Case-insensitive search
grep -i "warning" app.log

# Invert match - lines that do NOT contain the pattern
grep -v "debug" app.log

# Count matching lines
grep -c "error" app.log

# Show line numbers
grep -n "function" src/main.ts

# List only filenames that contain a match
grep -rl "deprecated" lib/
```

### 2.2 Regular Expressions - The Pattern Language

Regular expressions are a language for describing text patterns. They are not specific to
grep - they appear in sed, awk, jq, Python, JavaScript, and virtually every programming
language. Learning them once pays off everywhere.

Use `grep -E` (extended regex) by default. Without `-E`, you need backslashes before
`+`, `?`, `{`, `(`, and `|`, which makes expressions harder to read.

**Anchors and boundaries:**

```bash
# ^ matches start of line, $ matches end of line
grep -E '^import' src/main.ts          # lines starting with "import"
grep -E '^\s*$' file.txt               # blank lines (only whitespace)
grep -E 'TODO$' src/main.ts            # lines ending with "TODO"

# \b matches a word boundary
grep -E '\berror\b' app.log            # "error" but not "errors" or "perror"
```

**Character classes and quantifiers:**

```bash
# . matches any single character
grep -E 'h.t' words.txt                # "hat", "hit", "hot", etc.

# [] matches any character in the set
grep -E '[aeiou]{3}' /usr/share/dict/words  # three consecutive vowels

# * means 0 or more, + means 1 or more, ? means 0 or 1
grep -E 'colou?r' text.txt             # "color" or "colour"
grep -E '[0-9]+\.[0-9]+' versions.txt  # version numbers like "1.5", "12.0"

# {n,m} matches between n and m times
grep -E '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' access.log  # IP addresses
```

**Groups and alternation:**

```bash
# () groups, | alternates
grep -E '(error|warning|critical)' app.log

# Back-references (requires -P for PCRE in grep, or use sed)
grep -P '(\w+)\s+\1' text.txt          # repeated words ("the the", "is is")
```

### 2.3 Practical grep Flags

```bash
# -o prints only the matching part (not the whole line)
grep -oE '[0-9]+\.[0-9]+\.[0-9]+' package.json   # extract version numbers

# -A/-B/-C shows context lines after/before/around each match
grep -A 3 "error" app.log              # match + 3 lines after
grep -B 2 "FAILED" test.log            # 2 lines before each failure
grep -C 1 "panic" server.log           # 1 line before and after

# -l lists files with matches, -L lists files without matches
grep -rl "console.log" src/            # files that still have console.log
grep -rL "test" lib/                   # source files missing tests
```

### 2.4 ripgrep (rg) - grep for the Modern Codebase

ripgrep is faster than grep, respects `.gitignore` by default, searches recursively by
default, and has saner output formatting. Use it for codebase searches.

```bash
# Basic search (recursive by default, respects .gitignore)
rg "TODO" src/

# Type filtering
rg "import" --type ts                  # only TypeScript files
rg "SELECT" --type sql                 # only SQL files

# Fixed string (no regex interpretation)
rg -F "user.name?.first" src/          # literal dots and question marks

# JSON output (machine-readable)
rg --json "error" app.log | jq -r 'select(.type == "match") | .data.lines.text'

# Count matches per file
rg -c "TODO" src/ | sort -t: -k2 -n -r | head -10
```

> **AGENTIC GROUNDING:** When an agent generates code, grep/rg is your first verification
> tool. "Did the agent actually remove all uses of the deprecated function?" -
> `rg "oldFunction" src/` answers in milliseconds. The Makefile's delta detection uses
> `git diff --stat` (text output) to check whether a polecat agent actually changed
> anything. grep is how you parse that output to find specific changes.

---

## Part 3: awk - The Programmable Filter

**Estimated time: 1.5-2 hours**

awk is to columnar text what jq is to JSON. If you have data in rows and columns -
log files, `ps` output, CSV, `/proc` files, `git log` output - awk is the tool.

> **HISTORY:** awk was created by Alfred Aho, Peter Weinberger, and Brian Kernighan at
> Bell Labs in 1977. The name is their initials. It was the first "little language" - a
> domain-specific language before that term existed. Aho later co-invented lex and
> contributed to compiler theory. Kernighan co-authored "The C Programming Language."
> awk has associative arrays (hash maps), predating Perl and Python by over a decade.

### 3.1 The awk Model

awk processes text line by line. For each line, it splits the line into fields and
applies pattern-action rules.

```
awk 'pattern { action }' input
```

If you omit the pattern, the action runs on every line. If you omit the action, matching
lines are printed.

```bash
# Print every line (like cat)
awk '{ print }' /etc/passwd

# Print lines matching a pattern (like grep)
awk '/error/' app.log

# Print specific fields
# By default, fields are split on whitespace
echo "alice 30 admin" | awk '{ print $1, $3 }'
# Output: alice admin
```

### 3.2 Fields and Separators

`$1` is the first field, `$2` the second, `$NF` the last. `$0` is the entire line.

```bash
# /etc/passwd is colon-separated
awk -F: '{ print $1, $7 }' /etc/passwd
# Output: root /bin/bash, daemon /usr/sbin/nologin, ...

# ps output is whitespace-separated
ps aux | awk '{ print $1, $2, $11 }'
# Output: USER PID COMMAND

# Tab-separated output
awk -F: 'BEGIN { OFS="\t" } { print $1, $3, $7 }' /etc/passwd
```

### 3.3 Built-in Variables

| Variable | Meaning |
|----------|---------|
| `$0`     | The entire current line |
| `$1..$N` | Fields 1 through N |
| `NR`     | Current record (line) number |
| `NF`     | Number of fields in current line |
| `FS`     | Field separator (default: whitespace) |
| `OFS`    | Output field separator (default: space) |
| `RS`     | Record separator (default: newline) |

```bash
# Add line numbers
awk '{ print NR, $0 }' file.txt

# Print lines with more than 5 fields
awk 'NF > 5' data.txt

# Print the last field of each line
awk '{ print $NF }' data.txt
```

### 3.4 BEGIN and END Blocks

`BEGIN` runs before any input is read. `END` runs after all input is processed.
This is where you initialize counters and print summaries.

```bash
# Count lines (like wc -l, but you understand the mechanism)
awk 'END { print NR }' file.txt

# Sum a column
awk -F, '{ sum += $3 } END { print "Total:", sum }' sales.csv

# Average
awk '{ sum += $2; n++ } END { print "Average:", sum/n }' scores.txt

# Count pattern occurrences
awk '/error/ { count++ } END { print count, "errors" }' app.log
```

### 3.5 Conditionals and Pattern Matching

```bash
# Conditional printing
ps aux | awk '$3 > 5.0 { print $1, $2, $3, $11 }'
# Processes using more than 5% CPU

# Range pattern - print lines between two patterns (inclusive)
awk '/BEGIN_SECTION/,/END_SECTION/' config.txt

# Regex match on a specific field
awk -F: '$7 ~ /bash/ { print $1 }' /etc/passwd
# Users whose shell contains "bash"

# Negated match
awk -F: '$7 !~ /nologin/ { print $1 }' /etc/passwd
```

### 3.6 Associative Arrays

awk's associative arrays are hash maps. They are the key to aggregation.

```bash
# Count occurrences of each value in column 1
awk '{ count[$1]++ } END { for (k in count) print k, count[k] }' access.log

# Group-by with sum
# Given: "sales department amount" per line
awk '{ totals[$2] += $3 } END { for (dept in totals) print dept, totals[dept] }' sales.txt

# Top IP addresses from a web access log
awk '{ ips[$1]++ } END { for (ip in ips) print ips[ip], ip }' access.log \
  | sort -rn | head -10
```

### 3.7 printf for Formatted Output

awk's `printf` gives you full control over output formatting.

```bash
# Formatted table
ps aux | awk 'NR>1 { printf "%-12s %6s %5.1f%%  %s\n", $1, $2, $3, $11 }' | head -10

# Right-aligned numbers
awk '{ printf "%20s %10.2f\n", $1, $2 }' prices.txt
```

### 3.8 awk as a Programming Language

awk supports variables, loops, conditionals, functions, and string operations. It is a
complete programming language, though you should reach for Python when awk gets complex
(that is Step 5).

```bash
# Fibonacci
awk 'BEGIN { a=0; b=1; for(i=0; i<20; i++) { print a; c=a+b; a=b; b=c } }'

# Running average with window
awk '{
  buf[NR % 5] = $1
  if (NR >= 5) {
    sum = 0
    for (i in buf) sum += buf[i]
    printf "%d\t%.2f\n", NR, sum/5
  }
}' temperatures.txt
```

### 3.9 Real-World awk

```bash
# Parse git log into a commit frequency table by author
git log --format='%ae' | awk '{ authors[$1]++ } END { for (a in authors) print authors[a], a }' | sort -rn

# Memory usage by process name (from /proc or ps)
ps aux | awk 'NR>1 { mem[$11] += $6 } END { for (p in mem) printf "%10d KB  %s\n", mem[p], p }' | sort -rn | head -10

# Parse /proc/meminfo
awk '/^(MemTotal|MemFree|MemAvailable|Buffers|Cached):/ { printf "%-16s %8.1f MB\n", $1, $2/1024 }' /proc/meminfo

# Extract timing data from a log file
# Log format: "2026-03-10T14:23:01 INFO request completed in 234ms"
grep "completed in" app.log \
  | awk '{ gsub(/ms/, "", $NF); times[NR]=$NF; sum+=$NF }
    END {
      n=NR
      printf "Requests: %d\n", n
      printf "Total:    %dms\n", sum
      printf "Average:  %.1fms\n", sum/n
    }'
```

> **AGENTIC GROUNDING:** `git log --format=...` produces text. `git diff --stat` produces
> text. `ps aux` produces text. Agent-generated metrics, build output, test results - all
> text. awk is the tool that parses these columnar text streams into structured data. The
> Makefile's polecat wrapper captures `git diff --stat` before and after an agent run to
> detect whether the agent actually produced changes. That comparison is a text operation
> that awk handles naturally.

---

## Part 4: sed - The Stream Editor

**Estimated time: 1-1.5 hours**

sed reads input line by line, applies transformation commands, and outputs the result.
It is the simplest transformation tool here: where grep finds and awk computes, sed
substitutes.

> **HISTORY:** sed was written by Lee McMahon at Bell Labs in 1974. It was designed to
> process files too large for ed (the interactive line editor). The "stream" in stream
> editor means it processes input sequentially without loading the entire file into memory.
> This design made it practical for files larger than available RAM - a real constraint in
> 1974 when a PDP-11 had 256KB.

### 4.1 Substitution - The Core Operation

90% of sed usage is the `s` command: `s/pattern/replacement/`.

```bash
# Replace first occurrence on each line
echo "hello world hello" | sed 's/hello/goodbye/'
# Output: goodbye world hello

# Replace ALL occurrences on each line (g flag)
echo "hello world hello" | sed 's/hello/goodbye/g'
# Output: goodbye world goodbye

# Case-insensitive replacement (GNU extension)
echo "Hello HELLO hello" | sed 's/hello/hi/gi'
# Output: hi hi hi
```

### 4.2 In-Place Editing

`-i` modifies the file directly. This is the most dangerous sed flag - there is no undo
except your version control.

```bash
# GNU sed (Linux) - in-place edit, no backup
sed -i 's/old/new/g' config.txt

# GNU sed - in-place with backup
sed -i.bak 's/old/new/g' config.txt    # creates config.txt.bak

# BSD sed (macOS) - requires an argument to -i, even if empty
sed -i '' 's/old/new/g' config.txt
```

The portable pattern for scripts that must work on both GNU and BSD:

```bash
sed -i.bak 's/old/new/g' file.txt && rm file.txt.bak
```

### 4.3 Address Ranges

You can restrict sed commands to specific lines or patterns.

```bash
# Line 3 only
sed '3s/foo/bar/' file.txt

# Lines 3 through 7
sed '3,7s/foo/bar/' file.txt

# From a pattern to another pattern
sed '/START/,/END/s/foo/bar/g' file.txt

# From a pattern to end of file
sed '/BEGIN/,$s/foo/bar/g' file.txt
```

### 4.4 Delete, Insert, Append

```bash
# Delete lines matching a pattern
sed '/^#/d' config.txt                 # remove comment lines
sed '/^$/d' file.txt                   # remove blank lines

# Delete a range
sed '10,20d' file.txt                  # remove lines 10-20

# Insert a line BEFORE a match
sed '/\[database\]/i\# Database configuration' config.ini

# Append a line AFTER a match
sed '/^server=/a\backup=192.168.1.2' config.ini
```

### 4.5 Back-References

Parentheses in the pattern capture groups. `\1`, `\2` etc. refer to them in the
replacement.

```bash
# Swap first and last name
echo "Alice Smith" | sed -E 's/^(\w+) (\w+)$/\2, \1/'
# Output: Smith, Alice

# Add quotes around a value
echo "name=alice" | sed -E 's/^([^=]+)=(.*)$/\1="\2"/'
# Output: name="alice"

# Extract a version number
echo "version: 2.4.1-beta" | sed -E 's/.*([0-9]+\.[0-9]+\.[0-9]+).*/\1/'
# Output: 2.4.1
```

Note: use `sed -E` for extended regex (same as `grep -E`). Without it, you need
`\(` and `\)` for groups.

### 4.6 Multiple Commands

```bash
# Chain with -e or semicolons
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt
sed 's/foo/bar/g; s/baz/qux/g' file.txt

# Comment out a section
sed '/^server_name/,/^}/s/^/#/' nginx.conf
```

### 4.7 Real-World sed

```bash
# Strip ANSI color codes from terminal output
sed 's/\x1b\[[0-9;]*m//g' colored-output.txt

# Convert environment variable format
# FROM: export DB_HOST=localhost
# TO:   DB_HOST: localhost
sed -E 's/^export ([A-Z_]+)=(.*)/\1: \2/' .env

# Fix a config value across all YAML files
find . -name "*.yaml" -exec sed -i 's/timeout: 30/timeout: 60/g' {} +

# Rename a TypeScript import across a codebase
find src/ -name "*.ts" -exec sed -i -E "s/from ['\"]\.\/old-module['\"]/from '.\/new-module'/g" {} +
```

> **AGENTIC GROUNDING:** sed is the tool for batch modifications - the kind of change
> an agent might make across many files. When you need to verify that a rename was applied
> correctly, or roll back a pattern replacement, or modify configs in a pipeline, sed does
> the work. But sed in-place editing (`-i`) is destructive. In an agentic workflow, always
> verify the transformation on a sample before running it across files: pipe first, `-i`
> second.

---

## Part 5: yq - YAML Processing

**Estimated time: 0.5-1 hour**

yq applies the jq mental model to YAML. If you understand jq (Part 1), yq is a syntax
shift, not a conceptual shift.

There are two tools called yq. This material covers mikefarah/yq (written in Go, the
standard on most systems). The other (kislyuk/yq, Python) is a thin wrapper around jq
that converts YAML to JSON, runs jq, and converts back.

### 5.1 Reading YAML

```bash
# Extract a field
yq '.name' config.yaml

# Nested access
yq '.database.host' config.yaml

# Array element
yq '.services[0].name' docker-compose.yaml

# Iterate array
yq '.items[]' list.yaml
```

### 5.2 Querying with select

```bash
# Filter items by status
yq '.[] | select(.status == "open")' backlog.yaml

# Filter and extract a field
yq '.[] | select(.priority == "high") | .title' backlog.yaml

# Combine conditions
yq '.[] | select(.status == "open" and .priority == "high")' backlog.yaml
```

### 5.3 Modifying YAML

```bash
# Set a value (outputs to stdout, does not modify file)
yq '.database.port = 5433' config.yaml

# In-place modification
yq -i '.database.port = 5433' config.yaml

# Add an element to an array
yq -i '.items += [{"name": "new item", "status": "open"}]' list.yaml

# Delete a field
yq -i 'del(.deprecated_field)' config.yaml
```

### 5.4 Format Conversion

```bash
# YAML to JSON
yq -o=json config.yaml

# JSON to YAML
yq -P config.json       # -P is "pretty print" which defaults to YAML output

# YAML to CSV (for simple flat structures)
yq -o=csv '.items' data.yaml
```

### 5.5 Real-World yq

```bash
# Query the project backlog directly (faster than running the Python script)
yq '.[] | select(.status == "open") | .title' docs/internal/backlog.yaml

# Count open items by priority
yq '[.[] | select(.status == "open")] | group_by(.priority) | .[] | {priority: .[0].priority, count: length}' docs/internal/backlog.yaml

# Edit a Docker Compose service
yq -i '.services.app.environment.NODE_ENV = "production"' docker-compose.yaml

# Merge two YAML files
yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' base.yaml override.yaml

# Extract all image tags from a Kubernetes manifest
yq '.spec.containers[].image' deployment.yaml
```

> **AGENTIC GROUNDING:** The project's `backlog.yaml` is managed by a Python CLI, but
> ad-hoc queries are faster with yq. When you want to verify an agent updated the backlog
> correctly, or check how many items are in a particular state, yq gives you the answer
> in a single command. The `bin/triangulate` script exports metrics as YAML - you can
> query those exports with yq without running the full script.

---

## Part 6: The Supporting Cast

**Estimated time: 1 hour**

These tools are rarely the star, but they complete nearly every pipeline. They are the
connective tissue.

### 6.1 sort

```bash
# Alphabetical sort
sort names.txt

# Numeric sort
sort -n numbers.txt

# Sort by specific field (e.g., sort by 3rd column)
sort -t, -k3 -n data.csv

# Reverse sort
sort -rn numbers.txt

# Unique sort (sort + deduplicate in one step)
sort -u names.txt

# Sort human-readable sizes
du -sh /var/log/* 2>/dev/null | sort -h
```

### 6.2 uniq

uniq only deduplicates ADJACENT lines. This is why you almost always `sort | uniq`.

```bash
# Deduplicate sorted input
sort access.log | uniq

# Count occurrences (the most common use)
awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -10
# Top 10 IP addresses by request count

# Show only duplicated lines
sort names.txt | uniq -d

# Show only unique (non-duplicated) lines
sort names.txt | uniq -u
```

### 6.3 cut

cut extracts columns from delimited text. It is simpler than awk for simple cases.

```bash
# Extract field 1 from colon-delimited file
cut -d: -f1 /etc/passwd

# Extract fields 1 and 7
cut -d: -f1,7 /etc/passwd

# Extract characters 1-10
cut -c1-10 file.txt

# Extract from a CSV (comma-delimited)
cut -d, -f2,4 data.csv
```

### 6.4 tr

tr translates or deletes characters. It operates on characters, not strings.

```bash
# Uppercase
echo "hello" | tr 'a-z' 'A-Z'
# Output: HELLO

# Delete characters
echo "hello world 123" | tr -d '0-9'
# Output: hello world

# Squeeze repeated characters
echo "too    many    spaces" | tr -s ' '
# Output: too many spaces

# Replace newlines with commas (turning lines into CSV)
printf "a\nb\nc\n" | tr '\n' ','
# Output: a,b,c,

# Delete carriage returns (fix Windows line endings)
tr -d '\r' < windows-file.txt > unix-file.txt
```

### 6.5 wc

```bash
# Count lines
wc -l file.txt

# Count words
wc -w file.txt

# Count characters
wc -c file.txt

# Count lines in multiple files
find src/ -name "*.ts" | xargs wc -l | tail -1
# Total lines of TypeScript
```

### 6.6 tee

tee splits a stream - it writes to a file AND passes through to stdout. Named after a
T-junction pipe fitting.

```bash
# Save output AND see it on screen
make build 2>&1 | tee build.log

# Insert a checkpoint in a pipeline (see intermediate results)
cat access.log | awk '{ print $1 }' | tee /dev/stderr | sort | uniq -c | sort -rn | head
# tee /dev/stderr shows the intermediate IP list on stderr while the pipeline continues

# Write to multiple files
echo "data" | tee file1.txt file2.txt > /dev/null
```

### 6.7 xargs

xargs converts stdin into command arguments. It bridges text streams and command
invocation.

```bash
# Delete all .log files found by find
find /tmp -name "*.log" -print0 | xargs -0 rm -f
# -print0 and -0 use null delimiters (handles filenames with spaces)

# Run a command for each line of input
cat urls.txt | xargs -I{} curl -sS "{}" -o /dev/null -w "%{http_code} {}\n"

# Parallel execution
find . -name "*.ts" -print0 | xargs -0 -P4 -I{} npx tsc --noEmit "{}"
# -P4 runs 4 processes in parallel

# Delete git branches matching a pattern
git branch | grep "feature/" | xargs git branch -d
```

### 6.8 column

```bash
# Align columnar output
mount | column -t

# Custom delimiter
cat data.csv | column -t -s,

# Useful after awk/cut to make output readable
ps aux | awk '{ print $1, $2, $3, $11 }' | column -t
```

---

## Part 7: Pipeline Composition - Putting It All Together

**Estimated time: 0.5 hours (reading) + challenges below**

The power of these tools is not individual capability - it is composition. A single
pipeline can replace a 50-line Python script, and it runs with zero startup time.

### 7.1 Composition Patterns

**Pattern 1: Extract, Filter, Count**

```bash
# Top 10 IP addresses from a web access log
awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -10
```

This is the most common pipeline pattern. Extract a field (awk), sort for uniq, count
(uniq -c), sort by count, take the top N.

**Pattern 2: Search, Extract, Transform**

```bash
# Find all TODO comments with their file and line number, sorted by file
rg -n "TODO" src/ | sed -E 's/:/ /' | awk '{ printf "%-40s line %-5s %s\n", $1, $2, substr($0, index($0,$3)) }' | sort
```

**Pattern 3: Generate, Expand, Execute**

```bash
# Restart all failed systemd services
systemctl list-units --state=failed --no-legend \
  | awk '{ print $1 }' \
  | xargs -I{} systemctl restart {}
```

**Pattern 4: Stream, Branch, Merge**

```bash
# Process a log, save errors to a file, continue processing everything
tail -f app.log | tee >(grep --line-buffered "ERROR" >> errors.log) | awk '{ print strftime("%H:%M:%S"), $0 }'
```

### 7.2 The Debugging Pipeline

When a complex pipeline gives wrong results, debug by building it incrementally:

```bash
# Start with just the source
cat access.log | head -5

# Add the first transformation
cat access.log | awk '{ print $1 }' | head -5

# Add the second
cat access.log | awk '{ print $1 }' | sort | head -5

# Keep adding until you find where it breaks
cat access.log | awk '{ print $1 }' | sort | uniq -c | head -5
```

Or use tee to inspect at any point without breaking the pipeline:

```bash
cat access.log | awk '{ print $1 }' | tee /dev/stderr | sort | uniq -c | sort -rn | head -10
```

The intermediate output goes to stderr (your terminal), and the pipeline continues on
stdout.

---

## Challenges

## Challenge: jq Deep Dive

Create a file `/tmp/repos.json` with this content:

```bash
cat > /tmp/repos.json << 'SAMPLE'
[
  {"name": "api-server", "language": "TypeScript", "stars": 142, "open_issues": 12, "archived": false, "topics": ["api", "rest", "backend"]},
  {"name": "web-ui", "language": "TypeScript", "stars": 89, "open_issues": 3, "archived": false, "topics": ["frontend", "react"]},
  {"name": "ml-pipeline", "language": "Python", "stars": 256, "open_issues": 28, "archived": false, "topics": ["ml", "data", "backend"]},
  {"name": "old-dashboard", "language": "JavaScript", "stars": 34, "open_issues": 0, "archived": true, "topics": ["frontend", "legacy"]},
  {"name": "cli-tools", "language": "Rust", "stars": 178, "open_issues": 7, "archived": false, "topics": ["cli", "tools"]},
  {"name": "data-loader", "language": "Python", "stars": 67, "open_issues": 15, "archived": false, "topics": ["data", "etl", "backend"]},
  {"name": "auth-service", "language": "Go", "stars": 201, "open_issues": 4, "archived": false, "topics": ["auth", "backend", "security"]},
  {"name": "docs-site", "language": "TypeScript", "stars": 23, "open_issues": 1, "archived": false, "topics": ["docs", "frontend"]}
]
SAMPLE
```

**Tasks (each should be a single jq command):**

1. List all non-archived repos sorted by stars (descending). Output format: `name (stars)`.
2. Total open issues across all non-archived repos.
3. Group repos by language. Output: `{language: count}`.
4. Find repos that have the "backend" topic AND more than 10 open issues.
5. Produce a summary object: `{total_repos, active_repos, total_stars, avg_stars_active, languages: [unique list]}`.
6. For each language, compute the average star count. Output as a sorted table.

<details>
<summary>Hints</summary>

1. `sort_by` takes a path expression. Use negative for descending.
2. `map(select(...)) | map(.field) | add`
3. `group_by(.language) | map({...})`
4. `select` supports `and`. Check `topics` with `any(.topics[]; . == "backend")` or the `contains` function.
5. `length` counts array elements. `unique` deduplicates.
6. Combine `group_by` with arithmetic in `map`.

</details>

<details>
<summary>Solutions</summary>

```bash
# 1. Non-archived repos sorted by stars descending
jq -r '[.[] | select(.archived == false)] | sort_by(-.stars) | .[] | "\(.name) (\(.stars))"' /tmp/repos.json

# 2. Total open issues (active repos)
jq '[.[] | select(.archived == false) | .open_issues] | add' /tmp/repos.json

# 3. Group by language
jq 'group_by(.language) | map({(.[0].language): length}) | add' /tmp/repos.json

# 4. Backend repos with >10 open issues
jq '.[] | select((.topics | any(. == "backend")) and .open_issues > 10) | .name' /tmp/repos.json

# 5. Summary object
jq '{
  total_repos: length,
  active_repos: [.[] | select(.archived == false)] | length,
  total_stars: [.[].stars] | add,
  avg_stars_active: ([.[] | select(.archived == false) | .stars] | add) / ([.[] | select(.archived == false)] | length),
  languages: [.[].language] | unique
}' /tmp/repos.json

# 6. Average stars by language
jq -r 'group_by(.language) | map({lang: .[0].language, avg: ([.[].stars] | add / length)}) | sort_by(-.avg) | .[] | "\(.lang)\t\(.avg)"' /tmp/repos.json
```

</details>

---

## Challenge: Log File Forensics

Create a sample access log:

```bash
cat > /tmp/access.log << 'SAMPLE'
192.168.1.10 - alice [10/Mar/2026:08:15:23 +0000] "GET /api/users HTTP/1.1" 200 1234
192.168.1.20 - bob [10/Mar/2026:08:15:45 +0000] "POST /api/login HTTP/1.1" 200 567
192.168.1.10 - alice [10/Mar/2026:08:16:01 +0000] "GET /api/users/1 HTTP/1.1" 200 890
10.0.0.5 - - [10/Mar/2026:09:22:10 +0000] "GET /api/health HTTP/1.1" 200 12
192.168.1.10 - alice [10/Mar/2026:09:30:00 +0000] "DELETE /api/users/5 HTTP/1.1" 403 45
192.168.1.30 - carol [10/Mar/2026:10:01:15 +0000] "GET /static/app.js HTTP/1.1" 200 89012
10.0.0.5 - - [10/Mar/2026:10:05:00 +0000] "GET /api/health HTTP/1.1" 200 12
192.168.1.20 - bob [10/Mar/2026:10:10:30 +0000] "PUT /api/users/2 HTTP/1.1" 500 234
192.168.1.10 - alice [10/Mar/2026:10:15:00 +0000] "GET /api/users HTTP/1.1" 200 1234
10.0.0.5 - - [10/Mar/2026:11:00:00 +0000] "GET /api/health HTTP/1.1" 200 12
192.168.1.30 - carol [10/Mar/2026:11:05:20 +0000] "GET /api/reports HTTP/1.1" 200 5678
192.168.1.20 - bob [10/Mar/2026:11:10:45 +0000] "POST /api/login HTTP/1.1" 401 89
192.168.1.40 - dave [10/Mar/2026:12:00:00 +0000] "GET / HTTP/1.1" 301 0
192.168.1.40 - dave [10/Mar/2026:12:00:01 +0000] "GET /app HTTP/1.1" 200 4567
192.168.1.10 - alice [10/Mar/2026:12:30:00 +0000] "POST /api/users HTTP/1.1" 201 345
10.0.0.5 - - [10/Mar/2026:13:00:00 +0000] "GET /api/health HTTP/1.1" 200 12
192.168.1.30 - carol [10/Mar/2026:13:15:30 +0000] "GET /api/reports/export HTTP/1.1" 500 123
192.168.1.20 - bob [10/Mar/2026:14:00:00 +0000] "GET /api/users HTTP/1.1" 200 1234
192.168.1.10 - alice [10/Mar/2026:14:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234
10.0.0.5 - - [10/Mar/2026:15:00:00 +0000] "GET /api/health HTTP/1.1" 200 12
SAMPLE
```

**Answer each question with a single pipeline (one line):**

1. How many requests came from each IP? Show as `count IP`, sorted by count descending.
2. Which endpoints returned 5xx status codes? Show the full log lines with context.
3. How many requests per hour? (Extract the hour from the timestamp, count per hour.)
4. List all unique usernames (3rd field), excluding `-` (unauthenticated).
5. What is the total bytes transferred (last field) for successful (2xx) requests?
6. Show a table of `method count` for each HTTP method used.

<details>
<summary>Solutions</summary>

```bash
# 1. Requests per IP
awk '{ print $1 }' /tmp/access.log | sort | uniq -c | sort -rn

# 2. 5xx errors with context
awk '$9 ~ /^5/' /tmp/access.log

# 3. Requests per hour
awk -F'[: ]' '{ print $5 }' /tmp/access.log | sort | uniq -c

# 4. Unique usernames (excluding unauthenticated)
awk '$3 != "-" { print $3 }' /tmp/access.log | sort -u

# 5. Total bytes for 2xx responses
awk '$9 ~ /^2/ { sum += $10 } END { print sum }' /tmp/access.log

# 6. HTTP method counts
grep -oE '"(GET|POST|PUT|DELETE|PATCH) ' /tmp/access.log | tr -d '"' | sort | uniq -c | sort -rn
```

</details>

---

## Challenge: CSV to Report with awk

Create a sample sales dataset:

```bash
cat > /tmp/sales.csv << 'SAMPLE'
date,region,product,units,price
2026-03-01,North,Widget,150,12.50
2026-03-01,South,Widget,200,12.50
2026-03-01,North,Gadget,75,24.99
2026-03-01,South,Gadget,120,24.99
2026-03-02,North,Widget,180,12.50
2026-03-02,South,Widget,165,12.50
2026-03-02,North,Gadget,90,24.99
2026-03-02,South,Gadget,110,24.99
2026-03-03,North,Widget,200,12.50
2026-03-03,South,Widget,175,12.50
2026-03-03,North,Gadget,85,24.99
2026-03-03,South,Gadget,130,24.99
SAMPLE
```

**Tasks (pure awk, no Python):**

1. Print the total revenue (units * price) per product.
2. Print the total revenue per region per product (a 2D group-by).
3. Print a daily revenue report with running totals.
4. Find the day with the highest total revenue.

<details>
<summary>Solutions</summary>

```bash
# 1. Total revenue per product
awk -F, 'NR>1 { rev[$3] += $4 * $5 } END { for (p in rev) printf "%-10s $%10.2f\n", p, rev[p] }' /tmp/sales.csv

# 2. Revenue per region per product
awk -F, 'NR>1 { key = $2 "/" $3; rev[key] += $4 * $5 } END { for (k in rev) printf "%-20s $%10.2f\n", k, rev[k] }' /tmp/sales.csv | sort

# 3. Daily revenue with running total
awk -F, 'NR>1 {
  day_rev[$1] += $4 * $5
}
END {
  # NOTE: asorti() is a gawk extension (not available in mawk/nawk).
  # If using Debian/Ubuntu default awk, pipe through sort instead.
  n = asorti(day_rev, days)
  running = 0
  printf "%-12s %12s %12s\n", "Date", "Daily Rev", "Running Total"
  printf "%-12s %12s %12s\n", "----", "---------", "-------------"
  for (i = 1; i <= n; i++) {
    running += day_rev[days[i]]
    printf "%-12s $%11.2f $%11.2f\n", days[i], day_rev[days[i]], running
  }
}' /tmp/sales.csv

# 4. Day with highest revenue
awk -F, 'NR>1 { day_rev[$1] += $4 * $5 }
END {
  max = 0
  for (d in day_rev) if (day_rev[d] > max) { max = day_rev[d]; best = d }
  printf "%s ($%.2f)\n", best, max
}' /tmp/sales.csv
```

</details>

---

## Challenge: Config Surgery with sed

Create a config file:

```bash
cat > /tmp/app.conf << 'SAMPLE'
# Application Configuration
# Last updated: 2026-03-01

[server]
host = 0.0.0.0
port = 8080
workers = 4
debug = true

[database]
host = localhost
port = 5432
name = myapp_dev
user = appuser
password = changeme

[cache]
enabled = true
ttl = 300
max_size = 1024

[logging]
level = DEBUG
file = /var/log/app.log
max_bytes = 10485760
backup_count = 5
SAMPLE
```

**Tasks (each should be a single sed command):**

1. Change `debug = true` to `debug = false`.
2. Change the database port from 5432 to 5433.
3. Comment out the entire `[cache]` section (add `#` before each line from `[cache]` to the line before `[logging]`).
4. Add `timeout = 30` after the `workers` line in `[server]`.
5. Change all occurrences of `host` (as a key) to `hostname`.

Verify each modification by diffing before and after:

```bash
cp /tmp/app.conf /tmp/app.conf.orig
# run your sed commands on /tmp/app.conf
diff /tmp/app.conf.orig /tmp/app.conf
```

<details>
<summary>Solutions</summary>

```bash
# Reset to original
cp /tmp/app.conf.orig /tmp/app.conf

# 1. Toggle debug
sed -i 's/^debug = true/debug = false/' /tmp/app.conf

# 2. Change database port
sed -i '/^\[database\]/,/^\[/{s/^port = 5432/port = 5433/}' /tmp/app.conf

# 3. Comment out cache section
sed -i '/^\[cache\]/,/^\[logging\]/{/^\[logging\]/!s/^/#/}' /tmp/app.conf

# 4. Add timeout after workers
sed -i '/^workers/a\timeout = 30' /tmp/app.conf

# 5. Rename host keys to hostname (only when host is a key, not in section headers)
sed -i -E 's/^(host)( = )/hostname\2/g' /tmp/app.conf
```

</details>

---

## Challenge: Pipeline Composition

Solve each problem with a single pipeline. No temp files, no scripts.

**Warm-up (2-tool pipelines):**

1. Count the number of unique file extensions in the current project:
   ```bash
   find . -type f -name "*.*" | sed 's/.*\.//' | sort -u | wc -l
   ```

2. Find the 5 largest files in the project (human-readable sizes):
   ```bash
   find . -type f -exec du -h {} + | sort -rh | head -5
   ```

**Intermediate (3-4 tool pipelines):**

3. List all TypeScript imports and their frequency across the codebase. Show the top 20.

4. Extract all unique error messages from a JSON log file (one JSON object per line)
   and count them.

5. Find all git authors and their commit counts in the last 30 days.

**Advanced (5+ tool pipelines):**

6. Produce a Markdown table of the project's npm dependencies showing name and version,
   sorted alphabetically.

7. For a web access log, produce a histogram of request counts per hour as a horizontal
   bar chart using `#` characters.

<details>
<summary>Solutions</summary>

```bash
# 3. TypeScript import frequency
rg "^import .+ from ['\"](.+)['\"]" --only-matching -g "*.ts" -g "*.tsx" \
  | sed "s/.*from ['\"]//;s/['\"]$//" | sort | uniq -c | sort -rn | head -20

# 4. Unique error messages from JSON log
# Assumes JSONL format with an "error" or "message" field
jq -r 'select(.level == "error") | .message' app.jsonl | sort | uniq -c | sort -rn

# 5. Git authors last 30 days
git log --since="30 days ago" --format='%aN' | sort | uniq -c | sort -rn

# 6. npm deps as Markdown table
jq -r '.dependencies // {} | to_entries | sort_by(.key) | .[] | "| \(.key) | \(.value) |"' package.json \
  | sed '1i\| Package | Version |\n|---------|---------|'

# 7. Hourly histogram from access log
awk -F'[: ]' '{ print $5 }' /tmp/access.log \
  | sort | uniq -c \
  | awk '{ printf "%s:00  %3d  ", $2, $1; for(i=0;i<$1;i++) printf "#"; printf "\n" }'
```

</details>

---

## Challenge: Build a YAML Query Tool

Write a shell function `bl` that queries the project's `docs/internal/backlog.yaml`
with human-friendly syntax:

```bash
bl               # list all open items (id + title)
bl open          # same as above
bl closed        # list closed items
bl all           # list all items
bl high          # high priority open items
bl tag infra     # open items tagged "infra"
bl count         # count of open items
bl show BL-001   # full details for one item
```

Implement this using yq. The function should work in bash and can be added to your
`.bashrc` or sourced from a script.

<details>
<summary>Solution</summary>

```bash
bl() {
  local file="docs/internal/backlog.yaml"
  if [ ! -f "$file" ]; then
    printf "backlog file not found: %s\n" "$file" >&2
    return 1
  fi

  local cmd="${1:-open}"
  local arg="$2"

  case "$cmd" in
    open)
      yq -r '.[] | select(.status == "open") | "\(.id)\t\(.priority)\t\(.title)"' "$file" | column -t -s$'\t'
      ;;
    closed)
      yq -r '.[] | select(.status == "closed") | "\(.id)\t\(.title)\t\(.reason // "-")"' "$file" | column -t -s$'\t'
      ;;
    all)
      yq -r '.[] | "\(.id)\t\(.status)\t\(.priority)\t\(.title)"' "$file" | column -t -s$'\t'
      ;;
    high|medium|low)
      yq -r --arg p "$cmd" '.[] | select(.status == "open" and .priority == $p) | "\(.id)\t\(.title)"' "$file" | column -t -s$'\t'
      ;;
    tag)
      if [ -z "$arg" ]; then
        printf "Usage: bl tag <tagname>\n" >&2
        return 1
      fi
      yq -r --arg t "$arg" '.[] | select(.status == "open" and (.tags // [] | any(. == $t))) | "\(.id)\t\(.title)"' "$file" | column -t -s$'\t'
      ;;
    count)
      yq '[.[] | select(.status == "open")] | length' "$file"
      ;;
    show)
      if [ -z "$arg" ]; then
        printf "Usage: bl show <BL-NNN>\n" >&2
        return 1
      fi
      yq --arg id "$arg" '.[] | select(.id == $id)' "$file"
      ;;
    *)
      printf "Unknown command: %s\n" "$cmd" >&2
      printf "Usage: bl [open|closed|all|high|medium|low|tag <t>|count|show <id>]\n" >&2
      return 1
      ;;
  esac
}
```

</details>

---

## Challenge: Text Pipeline Playground (Notebook)

If you prefer interactive exploration, create a Jupyter notebook that demonstrates the
tools covered in this step. Use the `%%bash` cell magic to run shell commands, and
structure the notebook as:

1. **Cell 1:** Generate sample data (JSON, CSV, log lines)
2. **Cell 2-5:** jq exercises with visible intermediate outputs
3. **Cell 6-8:** grep + awk pipelines with step-by-step buildup
4. **Cell 9-10:** sed transformations showing before/after diffs
5. **Cell 11:** A complex multi-tool pipeline with inline commentary

This is an optional exercise for learners who want hands-on experimentation with
immediate visual feedback.

---

## The Mental Model

After working through this step, you should hold this picture:

```
                        text in
                           |
                    +------+------+
                    |             |
              structured     unstructured
              (JSON/YAML)    (logs, output, CSV)
                    |             |
               jq / yq      grep (find)
              query,         awk  (compute)
              reshape,       sed  (transform)
              filter         cut  (extract)
                    |             |
                    +------+------+
                           |
                     sort | uniq | wc
                     (aggregate)
                           |
                      tee (branch)
                     xargs (execute)
                           |
                        text out
```

Every tool does one thing. Pipes compose them. The structured tools (jq, yq) handle
nested data with their own internal pipelines. The unstructured tools (grep, awk, sed,
cut, tr) handle line-oriented text. sort, uniq, wc, tee, and xargs are the glue.

The boundary between "reach for jq" and "reach for awk" is the data format:
- JSON or YAML with nesting? Use jq/yq.
- Lines and columns? Use awk.
- Find a pattern? Use grep.
- Replace a pattern? Use sed.
- All of the above in sequence? Pipe them together.

---

## Common Pitfalls

**1. Forgetting `-r` with jq.** Without it, strings come out quoted. Your shell pipeline
will break because `"alice"` (with quotes) is not the same as `alice`.

**2. Using `uniq` without `sort`.** uniq only deduplicates adjacent identical lines.
`sort | uniq` is the correct idiom.

**3. sed `-i` without version control.** In-place editing is destructive. Always commit
first or use `-i.bak`.

**4. Shell variable interpolation in jq expressions.** Use `--arg` and `--argjson`.
String concatenation breaks on special characters and is an injection vector.

**5. Forgetting that awk field numbering starts at 1.** `$0` is the whole line, `$1` is
the first field. There is no `$-1` for the last field - use `$NF`.

**6. Using grep when you need awk.** If you are chaining `grep | cut | grep`, you
probably want a single awk command.

**7. Quoting in find + xargs.** Filenames with spaces break `find | xargs`. Always use
`find -print0 | xargs -0`.

---

## What to Read Next

- [**Step 5: Python CLI Tools**](/bootcamp/05-python-cli-tools/) - when shell pipelines
  hit their ceiling (complex logic, error handling, state across iterations), Python takes
  over. Step 5 covers building CLI tools in Python that compose with the same pipeline
  model.

- **Step 6: Make/Just as Orchestrators** - the tools in this step are verbs. Make/Just
  provide the nouns (targets) and grammar (dependency graph) that compose those verbs
  into reproducible build and verification pipelines.

---

## Appendix: Cheat Sheet

### jq

```
jq '.'                                   # Pretty-print JSON
jq '.field'                              # Extract field
jq '.items[]'                            # Iterate array
jq '.items[0]'                           # First element
jq '.items[-1]'                          # Last element
jq '.[] | .name'                         # Extract field from each element
jq '.[] | select(.age > 30)'             # Filter by condition
jq '{name: .first, age: .years}'         # Construct new object
jq '[.[] | .field]'                      # Collect iteration into array
jq 'map(.price) | add'                   # Sum an array
jq 'group_by(.key)'                      # Group by field
jq 'sort_by(.field)'                     # Sort by field
jq 'unique_by(.field)'                   # Deduplicate by field
jq 'length'                              # Array length / object key count
jq 'keys'                                # Object keys as array
jq -r '...'                              # Raw output (no quotes)
jq -s '...'                              # Slurp all inputs into array
jq --arg name "$var" '...'               # Pass string variable
jq --argjson n "$num" '...'              # Pass numeric variable
jq -r '.[] | "\(.a)\t\(.b)"'            # String interpolation
jq 'try ... catch "fallback"'            # Error handling
```

### grep / rg

```
grep "pattern" file                      # Basic search
grep -r "pattern" dir/                   # Recursive search
grep -E "extended|regex" file            # Extended regex
grep -i "case" file                      # Case-insensitive
grep -v "exclude" file                   # Invert match
grep -c "pattern" file                   # Count matches
grep -n "pattern" file                   # Show line numbers
grep -l "pattern" dir/ -r               # List matching files
grep -o "pattern" file                   # Print only match
grep -A3 -B2 "pattern" file             # Context lines
rg "pattern"                             # ripgrep (recursive, .gitignore aware)
rg -t ts "pattern"                       # Filter by file type
rg -F "literal.string"                   # No regex, literal match
rg -c "pattern" | sort -t: -k2 -nr      # Count per file, sorted
```

### awk

```
awk '{ print $1 }' file                  # First field
awk -F: '{ print $1, $NF }' file        # Custom separator, last field
awk '/pattern/ { print }' file           # Filter by pattern
awk '$3 > 100' file                      # Filter by field value
awk '{ sum += $2 } END { print sum }'    # Sum a column
awk '{ count[$1]++ } END { for (k in count) print k, count[k] }'   # Group+count
awk 'NR > 1' file                        # Skip header line
awk '{ printf "%-20s %10.2f\n", $1, $2 }'  # Formatted output
awk 'BEGIN { OFS="\t" } { print $1, $3 }'   # Tab-separated output
awk '/start/,/end/' file                 # Range between patterns
```

### sed

```
sed 's/old/new/' file                    # Replace first occurrence per line
sed 's/old/new/g' file                   # Replace all occurrences per line
sed -i 's/old/new/g' file               # In-place edit (GNU)
sed -i.bak 's/old/new/g' file           # In-place with backup
sed -E 's/(group)/\1-suffix/g' file     # Extended regex, back-references
sed '3,7s/old/new/' file                # Replace in line range
sed '/pattern/d' file                    # Delete matching lines
sed '/pattern/a\new line' file           # Append after match
sed '/pattern/i\new line' file           # Insert before match
sed '/start/,/end/s/a/b/g' file         # Replace within pattern range
```

### yq

```
yq '.field' file.yaml                    # Extract field
yq '.items[]' file.yaml                  # Iterate array
yq '.[] | select(.key == "val")' f.yaml  # Filter
yq -i '.field = "value"' file.yaml       # In-place modify
yq -o=json file.yaml                     # YAML to JSON
yq -P file.json                          # JSON to YAML
yq eval-all '. as $item ireduce ({}; . * $item)' a.yaml b.yaml   # Merge files
```

### Supporting Cast

```
sort file                                # Alphabetical sort
sort -n file                             # Numeric sort
sort -k2 -t, -rn file                   # Sort by 2nd comma-separated field, numeric, reverse
sort -u file                             # Sort and deduplicate
uniq                                     # Deduplicate adjacent lines (use after sort)
uniq -c                                  # Count occurrences
cut -d: -f1,7 file                       # Extract fields by delimiter
tr 'a-z' 'A-Z'                          # Translate characters
tr -d '\r'                               # Delete characters
tr -s ' '                               # Squeeze repeated characters
wc -l file                               # Count lines
wc -w file                               # Count words
tee file.txt                             # Write to file AND pass through
tee /dev/stderr                          # Debug: see intermediate pipeline data
xargs command                            # Convert stdin to arguments
xargs -0                                 # Null-delimited input (with find -print0)
xargs -I{} cmd {} arg                   # Placeholder for each input line
xargs -P4                                # Parallel execution (4 processes)
column -t                                # Align columns
column -t -s,                            # Align with custom separator
```
