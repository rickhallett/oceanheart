+++
title = "Python as a CLI Tool - The Escape Hatch from Shell Complexity"
date = "2026-03-10"
description = "The escape hatch from shell complexity. stdin/stdout, exit codes, argparse, subprocess, uv."
tags = ["python", "cli", "subprocess", "uv", "argparse", "bootcamp"]
step = 5
tier = 1
estimate = "4 hours"
bootcamp = 1
+++

Step 5 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Steps 1-4 (process model, shell language, filesystem, text pipeline)
**Key dependency:** understanding that processes communicate via stdin/stdout/stderr and exit codes

---

## Overview

This is not "learn Python." You already know Python. This is "learn Python as a Unix
citizen" - a process that reads stdin, writes stdout, returns exit codes, and composes
with other processes in pipelines. The boundary between shell and Python is one of the
most important judgment calls in agentic engineering. Get it wrong in either direction
and you create maintenance problems: shell scripts that should be Python (brittle,
untestable, unreadable past 30 lines) or Python scripts that should be shell (over-
engineered, slow to write, poor composition).

This project enforces a standing order: **Python uses `uv` exclusively (SD-310, no
exceptions).** Every Python example in this step uses `uv run`.

---

## 1. The Shell-Python Boundary (~30 min)

The single most valuable concept in this step. Everything else is mechanics.

### When to Use Shell

- **Process composition** - wiring programs together with pipes
- **File manipulation** - mv, cp, mkdir, chmod, find + xargs
- **Simple text transforms** - grep, sed, awk, cut, sort, uniq (Step 4 tools)
- **Glue between programs** - "run A, check exit code, run B"
- **One-liners and short scripts** - under ~30 lines

Shell is at its best when the problem is: "take the output of this program and feed it
to that program." That is what shell was designed for. It is a process orchestration
language, not a general-purpose programming language.

### When to Use Python

- **Data structures beyond strings** - dicts, lists, nested objects, anything that is not
  a flat stream of lines
- **Complex error handling** - try/except, cleanup logic, transactional operations
- **JSON/YAML processing with logic** - not just extraction (jq does that), but
  transformation with conditionals, validation, cross-referencing
- **Anything over ~30 lines** - shell's readability degrades fast
- **Anything that needs tests** - testing shell is painful; testing Python is natural
- **Complex argument parsing** - subcommands, typed arguments, help generation

### The Litmus Test

> Can I express this as a pipeline of existing tools?

If yes, use shell. If no, use Python.

```bash
# YES - this is a pipeline of existing tools. Shell wins.
git log --format='%H %s' | grep 'fix:' | wc -l

# NO - this requires parsing YAML, matching findings across files,
# computing similarity scores. Python wins.
# (This is exactly what bin/triangulate does.)
```

### Anti-Patterns

**Python that shells out for things Python does natively:**

```python
# BAD - why are you shelling out to grep from Python?
import os
result = os.system("grep -r 'TODO' src/")

# GOOD - use Python's own capabilities
from pathlib import Path
for f in Path("src").rglob("*"):
  if f.is_file():
    for i, line in enumerate(f.read_text().splitlines(), 1):
      if "TODO" in line:
        print(f"{f}:{i}: {line.strip()}")

# ALSO GOOD - if you really want grep's behavior, use subprocess properly
import subprocess
result = subprocess.run(["grep", "-r", "TODO", "src/"], capture_output=True, text=True)
print(result.stdout)
```

**Shell that generates Python to eval:**

```bash
# BAD - fragile, undebuggable, injection risk
python3 -c "
import json
data = json.loads('$(cat data.json)')
print(data['key'])
"

# GOOD - write a proper script or pipe via stdin
cat data.json | python3 -c "import json, sys; print(json.loads(sys.stdin.read())['key'])"

# BEST - just use jq
jq '.key' data.json
```

> **AGENTIC GROUNDING:** Agents frequently generate scripts at the wrong level -
> Python scripts that call `os.system("ls")` or shell scripts with inline Python
> heredocs. Recognising the boundary lets you redirect an agent to the correct tool
> before it generates something fragile. The litmus test ("pipeline of existing
> tools?") is fast enough to apply in real-time during agent review.

---

## 2. Python as a Unix Process (~30 min)

Everything from Step 1 applies. A Python script is a process with file descriptors 0,
1, and 2. It receives signals. It returns an exit code. It can be on either end of a
pipe.

### Standard Streams

```python
import sys

# These ARE file descriptors 0, 1, 2 from Step 1
sys.stdin   # fd 0 - reads input
sys.stdout  # fd 1 - writes output (print() goes here)
sys.stderr  # fd 2 - writes errors/diagnostics

# Reading all of stdin at once
data = sys.stdin.read()

# Reading stdin line by line (memory-efficient for large inputs)
for line in sys.stdin:
  process(line.rstrip('\n'))

# Writing to stdout
print("result")                    # adds newline
sys.stdout.write("result\n")      # explicit newline

# Writing diagnostics to stderr (so they don't pollute stdout in a pipe)
print("warning: something odd", file=sys.stderr)
```

### Binary Mode

When processing binary data through pipes (images, compressed data, protocol buffers),
the text-mode wrappers will corrupt the data. Use the buffer attribute:

```python
import sys

# Read binary from stdin
raw = sys.stdin.buffer.read()

# Write binary to stdout
sys.stdout.buffer.write(raw)
```

### Exit Codes

From Step 1, you know exit codes. Python controls them with `sys.exit()`:

```python
import sys

sys.exit(0)   # success - same as the process ending normally
sys.exit(1)   # failure - general error
sys.exit(2)   # usage error - bad arguments (convention from BSD)

# Non-zero means failure. The calling shell checks with $?
# set -e in a shell script will abort on non-zero
# subprocess.run(check=True) will raise on non-zero
```

### Signal Handling

From Step 1, you know signals. Python can catch them:

```python
import signal
import sys

def handle_sigterm(signum, frame):
  """Clean shutdown - flush buffers, close files, exit cleanly."""
  sys.stderr.write("Received SIGTERM, shutting down\n")
  sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)  # Ctrl+C
```

This matters for long-running CLI tools (daemons, watchers). For short scripts, the
default handler (terminate) is usually fine.

### Participating in Pipes

A well-behaved Python CLI tool composes with other tools exactly like grep or awk:

```bash
# Python script in the middle of a pipeline
curl -s https://api.example.com/data | python3 filter.py --status active | sort | head -20

# Python script at the start
python3 generate_report.py | grep 'CRITICAL' | mail -s 'Alert' admin@example.com

# Python script at the end
cat server.log | python3 parse_errors.py --format json > errors.json
```

> **AGENTIC GROUNDING:** When an agent generates a Python script, check: does it read
> from stdin when appropriate? Does it write to stdout? Does it use proper exit codes?
> A script that only reads from hardcoded file paths and prints "Done!" is not a Unix
> citizen - it cannot participate in pipelines. The composability of agent-generated
> tools directly determines whether they can be chained into larger workflows.

> **HISTORY:** Python's `sys.stdin`/`sys.stdout`/`sys.stderr` are thin wrappers around
> the C library's `stdin`/`stdout`/`stderr` file pointers, which are themselves wrappers
> around file descriptors 0, 1, 2 that you learned about in Step 1. The abstraction
> layers are: kernel fd -> C FILE* -> Python file object. Same bytes, different handles.

---

## 3. Argument Parsing (~45 min)

### argparse - The Standard Library Approach

`argparse` is verbose but complete. It handles positional arguments, optional flags,
types, choices, defaults, subcommands, and auto-generated help text. It is what this
project uses (see `scripts/backlog.py`).

```python
import argparse
import sys

def main():
  parser = argparse.ArgumentParser(
    prog="mytool",
    description="Process data files and output results",
  )

  # Positional argument
  parser.add_argument("input", help="Input file (use - for stdin)")

  # Optional arguments
  parser.add_argument("--format", "-f", choices=["json", "text", "csv"],
                      default="text", help="Output format (default: text)")
  parser.add_argument("--quiet", "-q", action="store_true",
                      help="Suppress non-essential output")
  parser.add_argument("--output", "-o", default="-",
                      help="Output file (default: stdout)")

  args = parser.parse_args()

  # Handle the Unix convention: - means stdin
  if args.input == "-":
    data = sys.stdin.read()
  else:
    from pathlib import Path
    data = Path(args.input).read_text()

  # Process...
  result = process(data, args.format)

  # Handle output
  if args.output == "-":
    sys.stdout.write(result)
  else:
    Path(args.output).write_text(result)

  if not args.quiet:
    print(f"Processed {len(data)} bytes", file=sys.stderr)

if __name__ == "__main__":
  main()
```

### Subcommands with argparse

The pattern used by `scripts/backlog.py` in this project. One tool, multiple operations:

```python
import argparse
import sys

def cmd_add(args):
  """Add a new item."""
  print(f"Added: {args.title} [priority={args.priority}]")

def cmd_list(args):
  """List items."""
  print("Listing items...")

def cmd_show(args):
  """Show a single item."""
  print(f"Showing: {args.id}")

def main():
  parser = argparse.ArgumentParser(prog="mytool")
  sub = parser.add_subparsers(dest="command")

  # mytool add "title" --priority high
  p_add = sub.add_parser("add", help="Add a new item")
  p_add.add_argument("title", help="Item title")
  p_add.add_argument("--priority", "-p", default="medium",
                      choices=["high", "medium", "low"])

  # mytool list --status open
  p_list = sub.add_parser("list", help="List items")
  p_list.add_argument("--status", "-s", default="open")

  # mytool show BL-001
  p_show = sub.add_parser("show", help="Show item details")
  p_show.add_argument("id", help="Item ID")

  args = parser.parse_args()

  if not args.command:
    parser.print_help()
    sys.exit(2)

  # Dispatch to the right handler
  {"add": cmd_add, "list": cmd_list, "show": cmd_show}[args.command](args)

if __name__ == "__main__":
  main()
```

### The `-` Convention for stdin

Unix tools universally accept `-` to mean "read from stdin instead of a file." Your
Python CLI tools should too:

```python
import sys
from pathlib import Path

def read_input(path_arg: str) -> str:
  """Read from a file path, or stdin if path is '-'."""
  if path_arg == "-":
    return sys.stdin.read()
  return Path(path_arg).read_text()
```

### Other Parsing Libraries (Mentioned, Not Deep-Dived)

- **click** - decorator-based. Cleaner for complex CLIs with many subcommands. Uses
  decorators instead of parser construction. `@click.command()`, `@click.option()`.
- **typer** - type-hint-based. Modern, uses click underneath. Function signatures
  become the CLI interface. `def main(name: str, count: int = 1):` becomes
  `--name` and `--count` flags automatically.

Both are good. This project uses `argparse` because it has zero external dependencies.

> **HISTORY:** Python's argparse descends from optparse, which descends from getopt,
> which descends from the C `getopt()` function standardized in POSIX. The convention
> of `-f` for short flags and `--file` for long flags comes from GNU `getopt_long()`
> (1990s). The `-` for stdin convention predates all of these - it comes from the
> original Unix utilities of the 1970s.

---

## 4. The `uv` Ecosystem (~45 min)

**Standing order SD-310: Python uses `uv` exclusively, no exceptions.**

`uv` is a Python package manager and project tool written in Rust. It replaces pip,
pipx, virtualenv, poetry, and pdm with a single tool that is 10-100x faster and
produces deterministic dependency resolution.

### Core Commands

```bash
# Run a Python script (creates/uses a virtual environment automatically)
uv run script.py

# Run a script with inline dependency metadata (PEP 723)
uv run --script script.py

# Install packages into the project's virtual environment
uv pip install pyyaml requests

# Create a virtual environment
uv venv

# Initialize a new Python project
uv init myproject

# Add a dependency to the project
uv add requests

# Sync dependencies (install what pyproject.toml declares)
uv sync
```

### PEP 723 - Inline Script Metadata

This is the mechanism that makes single-file Python scripts self-contained. The script
declares its own dependencies in a comment block:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6.0", "requests>=2.28"]
# ///
"""My script that needs PyYAML and requests."""

import yaml
import requests
# ... rest of the script
```

When you run `uv run --script this_file.py`, `uv` reads the metadata comment, installs
the declared dependencies into an isolated environment, and runs the script. No
requirements.txt. No pyproject.toml. No manual `pip install`. One file, everything
declared inline.

### The Shebang Pattern

Combine the PEP 723 metadata with a shebang line and the script becomes directly
executable:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6.0"]
# ///
```

Then:

```bash
chmod +x myscript.py
./myscript.py  # uv handles dependencies and execution
```

### Real Example: bin/triangulate

This project's `bin/triangulate` uses exactly this pattern. Examine its first 5 lines:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6.0"]
# ///
```

It is a 979-line Python CLI tool that parses structured YAML review files, computes
cross-model triangulation metrics, and outputs human-readable summaries or machine-
readable YAML. It is executable directly:

```bash
bin/triangulate summary review1.yaml review2.yaml review3.yaml
bin/triangulate metrics review1.yaml review2.yaml --match-threshold 0.7
```

The shebang makes `uv` handle everything. No activation of virtual environments. No
`python3 bin/triangulate`. Just `bin/triangulate`.

### Why uv Over pip/pipx/poetry/pdm

| Concern | uv | pip + venv | poetry | pdm |
|---------|----|-----------|--------|-----|
| Speed | 10-100x faster | baseline | ~1x | ~1x |
| Single tool | yes | no (pip + venv + pip-tools) | yes | yes |
| Lock file | yes | no (needs pip-tools) | yes | yes |
| Inline deps (PEP 723) | yes | no | no | no |
| Rust-based | yes | no | no | no |
| Drop-in pip compat | yes | n/a | no | partial |

The speed difference is not marginal. On a cold install of a project with 50
dependencies, pip takes 15-30 seconds. uv takes under 1 second. In an agentic
workflow where agents may spin up scripts frequently, this matters.

### uv Quick Reference

```bash
# Run scripts
uv run script.py                    # run with project deps
uv run --script script.py           # run with inline PEP 723 deps
uv run python -c "import sys; ..."  # run inline Python

# Package management
uv pip install <pkg>                # install into current venv
uv pip install -r requirements.txt  # install from requirements
uv add <pkg>                        # add to pyproject.toml + install
uv remove <pkg>                     # remove from pyproject.toml
uv sync                             # sync venv to pyproject.toml lockfile

# Environment management
uv venv                             # create .venv in current dir
uv venv --python 3.12               # specify Python version
uv python install 3.12              # install a Python version
uv python list                      # list available Pythons

# Project scaffolding
uv init myproject                   # new project with pyproject.toml
uv init --script myscript.py        # new script with PEP 723 metadata
```

> **AGENTIC GROUNDING:** When an agent needs to run a Python script with dependencies,
> the correct invocation is `uv run --script script.py` with inline PEP 723 metadata.
> If you see an agent writing `pip install` or creating requirements.txt for a one-off
> script, redirect it to the uv pattern. The project's standing order is unambiguous.

> **HISTORY:** PEP 723 (2024) is recent. Before it, single-file Python scripts with
> dependencies required either a companion requirements.txt, a pyproject.toml, or
> manual `pip install` by the user. PEP 723 solves the "I want to share one .py file
> that just works" problem. The `# /// script` marker is inspired by TOML-in-comments
> patterns from other ecosystems.

---

## 5. subprocess - Composing Processes from Python (~30 min)

When Python needs to invoke external programs, `subprocess` is the correct module.
Not `os.system()`. Not `os.popen()`. Not `commands.getoutput()`. Those are all
deprecated or dangerous. Use `subprocess.run()`.

### The One Function You Need

```python
import subprocess

# Basic: run a command, check for errors
result = subprocess.run(
  ["git", "log", "--oneline", "-5"],
  capture_output=True,  # capture stdout and stderr
  text=True,            # decode bytes to str
  check=True,           # raise CalledProcessError on non-zero exit
)
print(result.stdout)
```

### Why List Form, Not String Form

```python
# GOOD - list form. Each argument is a separate element.
# No shell injection possible. No quoting bugs.
subprocess.run(["grep", "-r", "TODO", "src/"])

# BAD - string form with shell=True. Shell interprets the string.
# Injection risk if any part comes from user input.
subprocess.run("grep -r TODO src/", shell=True)
```

The list form bypasses the shell entirely - the kernel's `execvp()` receives the
argument array directly. This is safer and more predictable. Only use `shell=True`
when you specifically need shell features (glob expansion, pipes, variable
substitution) and the input is fully trusted.

### Common Patterns

```python
import subprocess
import sys

# Check if a command succeeded (exit code only)
result = subprocess.run(["pnpm", "run", "typecheck"], capture_output=True, text=True)
if result.returncode != 0:
  print("Typecheck failed:", file=sys.stderr)
  print(result.stderr, file=sys.stderr)
  sys.exit(1)

# Get command output as a string
version = subprocess.run(
  ["git", "describe", "--tags", "--always"],
  capture_output=True, text=True, check=True,
).stdout.strip()

# Run with a timeout (seconds)
try:
  subprocess.run(["long-task"], timeout=30, check=True)
except subprocess.TimeoutExpired:
  print("Task timed out after 30s", file=sys.stderr)
  sys.exit(1)

# Pass stdin to a subprocess
result = subprocess.run(
  ["python3", "-c", "import sys; print(sys.stdin.read().upper())"],
  input="hello world",
  capture_output=True, text=True, check=True,
)
print(result.stdout)  # "HELLO WORLD\n"
```

### When to Use subprocess vs Doing It in Python

Use subprocess when:
- An external tool does the job better (git, curl, ffmpeg, jq)
- You need the exact behavior of a specific program
- You are wrapping a system tool with additional logic

Do it in Python when:
- Python's stdlib does it (file I/O, string processing, JSON, HTTP)
- You need the result as a Python data structure, not text
- The external tool would require parsing text output back into structured data

```python
# subprocess is correct here - git is the authority on git state
branch = subprocess.run(
  ["git", "rev-parse", "--abbrev-ref", "HEAD"],
  capture_output=True, text=True, check=True,
).stdout.strip()

# Python is correct here - no need to shell out for JSON
import json
data = json.loads(Path("config.json").read_text())
```

### Multi-Process Pipelines (Rare)

If you need to chain multiple processes with pipes from Python, you can use
`subprocess.Popen`. But this is rare - if the problem is "chain processes with
pipes," shell is usually the better tool:

```python
# This is possible but awkward in Python
from subprocess import Popen, PIPE

p1 = Popen(["cat", "data.txt"], stdout=PIPE)
p2 = Popen(["grep", "error"], stdin=p1.stdout, stdout=PIPE)
p1.stdout.close()  # allow p1 to receive SIGPIPE if p2 exits
output = p2.communicate()[0]

# Same thing in shell - cleaner
# cat data.txt | grep error
```

If you find yourself building complex Popen pipelines in Python, step back and ask
whether shell should be orchestrating the pipeline and Python should be one stage in it.

---

## 6. File and Path Handling (~30 min)

### pathlib.Path - The Modern Approach

`pathlib` (stdlib since Python 3.4) replaces `os.path` for almost everything. It is
object-oriented, composable, and reads naturally:

```python
from pathlib import Path

# Construction
p = Path("docs/internal/backlog.yaml")
p = Path.home() / ".config" / "myapp" / "settings.json"
p = Path(__file__).parent  # directory containing the current script

# Reading and writing
text = p.read_text(encoding="utf-8")
p.write_text("new content", encoding="utf-8")
raw = p.read_bytes()
p.write_bytes(b"\x00\x01\x02")

# Inspection
p.exists()
p.is_file()
p.is_dir()
p.name          # "backlog.yaml"
p.stem          # "backlog"
p.suffix        # ".yaml"
p.parent        # Path("docs/internal")

# Directory operations
p.mkdir(parents=True, exist_ok=True)  # like mkdir -p

# Globbing
for f in Path("lib").rglob("*.ts"):
  print(f)
```

### Atomic Writes

From Step 3, you learned that writes are not atomic - a crash mid-write corrupts
the file. The safe pattern: write to a temporary file, then rename (which is atomic
on the same filesystem):

```python
import os
import tempfile
from pathlib import Path

def atomic_write(path: Path, content: str) -> None:
  """Write content to a file atomically via temp + rename."""
  # Create temp file in the same directory (same filesystem = atomic rename)
  fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
  try:
    with os.fdopen(fd, "w") as f:
      f.write(content)
    os.rename(tmp_path, path)  # atomic on same filesystem
  except Exception:
    os.unlink(tmp_path)  # clean up on failure
    raise
```

### Structured Data Formats

```python
import json
from pathlib import Path

# JSON
data = json.loads(Path("config.json").read_text())
Path("output.json").write_text(json.dumps(data, indent=2) + "\n")

# YAML (requires pyyaml - declare in PEP 723 metadata)
import yaml
data = yaml.safe_load(Path("config.yaml").read_text())
yaml.dump(data, open("output.yaml", "w"), default_flow_style=False, sort_keys=False)

# TOML (stdlib in Python 3.11+)
import tomllib
with open("pyproject.toml", "rb") as f:
  data = tomllib.load(f)
```

Always use `yaml.safe_load()`, never `yaml.load()`. The latter can execute arbitrary
Python code embedded in the YAML. This is a real security vulnerability, not a
theoretical one.

---

## 7. Structured Output (~20 min)

A CLI tool needs to serve two audiences: humans reading terminal output and machines
parsing structured data.

### The Convention

- **Default:** human-readable text to stdout
- **`--json` flag:** machine-readable JSON to stdout
- **`--quiet` / `-q` flag:** suppress non-essential output (exit code is the signal)
- **Diagnostics:** always to stderr (never pollute the data stream)

```python
import json
import sys

def output_results(results: list[dict], fmt: str, quiet: bool) -> None:
  if quiet:
    return  # only exit code matters

  if fmt == "json":
    json.dump(results, sys.stdout, indent=2)
    sys.stdout.write("\n")
  else:
    for r in results:
      status = "PASS" if r["ok"] else "FAIL"
      print(f"  [{status}] {r['name']}")
```

### Colored Output

Color is for humans. Detect whether stdout is a terminal before emitting ANSI codes:

```python
import sys

def supports_color() -> bool:
  """Check if stdout is a terminal that supports color."""
  return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

# Usage
if supports_color():
  RED = "\033[31m"
  GREEN = "\033[32m"
  RESET = "\033[0m"
else:
  RED = GREEN = RESET = ""

print(f"{RED}ERROR{RESET}: something failed")
```

When your output is piped to another program (`mytool | grep error`), `isatty()` returns
False and the ANSI codes are suppressed. This is the correct behavior - ANSI codes in
piped data break downstream processing.

The project's `pitkeel/pitkeel.py` uses this pattern with named ANSI constants:

```python
BOLD = "\033[1m"
DIM = "\033[2m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
RESET = "\033[0m"
```

> **AGENTIC GROUNDING:** When reviewing agent-generated CLI tools, check for the
> `--json` / `--quiet` pattern. An agent tool that only outputs human-readable text
> cannot be composed into automated pipelines. An agent tool that always outputs JSON
> is unpleasant for human debugging. The dual-mode pattern serves both consumers.

---

## 8. The `if __name__ == "__main__":` Idiom (~10 min)

You have seen this a thousand times. Here is what it actually means.

When Python runs a file directly (`python3 myscript.py`), it sets that module's
`__name__` variable to `"__main__"`. When the same file is imported by another module
(`import myscript`), `__name__` is set to `"myscript"`.

The idiom gates execution:

```python
def main():
  # CLI logic here
  pass

if __name__ == "__main__":
  main()
```

This means:
- `python3 myscript.py` - runs `main()`. The file is a CLI tool.
- `import myscript` - does not run `main()`. The file is a library.
- `myscript.some_function()` - callable from both contexts.

This is the bridge between "Python module" and "Python CLI tool." It allows the same
file to be both importable (for testing, for reuse) and executable (for CLI use).

Every Python CLI tool in this project uses it:
- `scripts/backlog.py:301` - `if __name__ == "__main__": main()`
- `pitkeel/pitkeel.py:607` - `if __name__ == "__main__": main()`
- `bin/triangulate:977` - `if __name__ == "__main__": main()`

---

## 9. Testing CLI Tools (~20 min)

A CLI tool is a function from `(args, stdin, env)` to `(stdout, stderr, exit_code)`.
Test it as such.

### Testing with subprocess

The most realistic test: invoke your tool as a separate process, exactly as a user
or pipeline would:

```python
import subprocess
import json

def test_mytool_json_output():
  """Tool produces valid JSON with --json flag."""
  result = subprocess.run(
    ["python3", "mytool.py", "input.txt", "--format", "json"],
    capture_output=True, text=True,
  )
  assert result.returncode == 0
  data = json.loads(result.stdout)
  assert "results" in data

def test_mytool_missing_file():
  """Tool exits 1 when input file does not exist."""
  result = subprocess.run(
    ["python3", "mytool.py", "nonexistent.txt"],
    capture_output=True, text=True,
  )
  assert result.returncode == 1
  assert "not found" in result.stderr.lower()

def test_mytool_stdin():
  """Tool reads from stdin when given -."""
  result = subprocess.run(
    ["python3", "mytool.py", "-"],
    input="test data\n",
    capture_output=True, text=True,
  )
  assert result.returncode == 0
  assert "test data" in result.stdout
```

### Testing with pytest (Captured Output)

For testing the internal functions without process overhead:

```python
import io
import sys
from mytool import process_data, main

def test_process_data():
  """Internal function produces correct results."""
  result = process_data("input", format="json")
  assert result["count"] == 5

def test_main_help(capsys):
  """--help prints usage and exits 2."""
  try:
    sys.argv = ["mytool", "--help"]
    main()
  except SystemExit as e:
    assert e.code == 0
  captured = capsys.readouterr()
  assert "usage:" in captured.out.lower()
```

The subprocess approach tests the tool as a black box. The pytest approach tests
internals. Both are valuable. The subprocess test catches integration issues (wrong
shebang, import errors, PATH problems). The pytest test is faster and more targeted.

---

## 10. Jupyter Notebooks as a Learning Tool (~15 min)

Notebooks are useful for exploration and learning. They are not for production code.

### Running Notebooks with uv

```bash
# Install and run Jupyter
uv run jupyter lab
uv run jupyter notebook

# Or add jupyter to a project
uv add --dev jupyter
uv run jupyter lab
```

### Shell Integration in Notebooks

Jupyter cells can execute shell commands:

```python
# Single shell command (prefix with !)
!ls -la /proc/self/fd

# Multi-line shell (cell magic)
%%bash
for f in *.py; do
  wc -l "$f"
done

# Capture shell output in a Python variable
files = !find . -name "*.py" -type f
print(f"Found {len(files)} Python files")
```

### When Notebooks Are Appropriate

- **Exploration** - trying out APIs, parsing logic, data transformations
- **Data analysis** - looking at metrics, visualizing trends
- **Learning** - working through these bootcamp exercises interactively
- **Documentation** - showing step-by-step processes with output

### When Notebooks Are NOT Appropriate

- **Production code** - cannot be imported, tested, or composed
- **CI pipelines** - require Jupyter runtime, non-trivial to execute headlessly
- **Version control** - `.ipynb` is JSON with embedded output blobs; diffs are noisy
  and merge conflicts are painful
- **CLI tools** - a notebook is not a Unix process; it does not participate in pipes

The `.ipynb` format is JSON - which means `jq` can process it, `git` can diff it
(poorly), and `nbstripout` can clean it for version control. If you version-control
notebooks, use `nbstripout` as a git filter to strip output before commit.

> **AGENTIC GROUNDING:** Agents occasionally suggest Jupyter notebooks for tasks that
> should be scripts. If the task involves automation, composition, or execution in a
> pipeline, redirect to a proper Python CLI tool. Notebooks are for the human to
> explore - not for the system to execute.

---

## Bringing It Together: Anatomy of a Real CLI Tool

Look at `scripts/backlog.py` in this project. It demonstrates every concept:

| Concept | Where in backlog.py |
|---------|---------------------|
| Shebang | `#!/usr/bin/env python3` (line 1) |
| Module docstring as help | Lines 2-35 |
| argparse with subcommands | Lines 240-298 |
| Reading/writing YAML | `_read_backlog()` / `_write_backlog()` (lines 72-87) |
| Exit codes | `sys.exit(1)` on not-found (lines 179, 195, 216) |
| stderr for errors | `file=sys.stderr` (lines 49, 178, 194, 215) |
| stdout for data | `yaml.dump(item, sys.stdout, ...)` (line 176) |
| `if __name__ == "__main__"` | Line 301 |
| Default command (no subcommand) | Lines 283-289 |

And `bin/triangulate` demonstrates the uv-specific patterns:

| Concept | Where in triangulate |
|---------|---------------------|
| uv shebang | `#!/usr/bin/env -S uv run --script` (line 1) |
| PEP 723 metadata | Lines 2-5 |
| Subcommand dispatch | Lines 960-974 |
| Human-readable output | `format_summary()` (lines 528-655) |
| Machine-readable output | `yaml.dump()` to stdout (line 911) |
| Error to stderr | `print(..., file=sys.stderr)` (lines 859, 873-879) |

---

## Challenge: Pipeline Citizen (stdin/stdout) (~30 min)

Write a Python script `filter_items.py` that:

1. Reads JSON from stdin (an array of objects)
2. Accepts a `--field` and `--value` argument
3. Filters the array to items where `field == value`
4. Writes the filtered array to stdout as JSON
5. Exits 0 on success, 1 on invalid JSON, 2 on bad arguments

Test it in a pipeline:

```bash
# Generate test data
printf '[{"name":"alice","role":"admin"},{"name":"bob","role":"user"},{"name":"carol","role":"admin"}]'

# Use it in a pipeline
printf '[{"name":"alice","role":"admin"},{"name":"bob","role":"user"},{"name":"carol","role":"admin"}]' \
  | python3 filter_items.py --field role --value admin \
  | python3 -m json.tool

# Chain with jq
printf '[{"name":"alice","role":"admin"},{"name":"bob","role":"user"}]' \
  | python3 filter_items.py --field role --value admin \
  | jq '.[].name'
```

**Verify:** Does your tool work with file redirection? `python3 filter_items.py --field role --value admin < data.json > result.json`

**Extend:** Add `--json` (pretty-print) and `--quiet` (no output, exit code only) flags.

---

## Challenge: Rewrite a Shell Script in Python (~40 min)

Take this shell pipeline that analyzes git commit patterns:

```bash
#!/bin/bash
# Count commits per author per day for the last 30 days
git log --since="30 days ago" --format='%ad %an' --date=short \
  | sort \
  | uniq -c \
  | sort -rn \
  | head -20 \
  | while read count date author; do
      printf "%-12s %-20s %d\n" "$date" "$author" "$count"
    done
```

Rewrite it as a Python CLI tool that:

1. Accepts `--days` (default 30) and `--limit` (default 20) arguments
2. Supports `--json` output mode
3. Uses subprocess to call git (git is the authority on git data)
4. Does the counting and sorting in Python (data structures beat text manipulation here)
5. Includes proper exit codes and error handling

Compare the two versions:
- Which is shorter?
- Which handles edge cases better (author names with spaces, empty repos)?
- Which is easier to test?
- When would you choose the shell version? When the Python version?

---

## Challenge: CLI Tool with Subcommands (~45 min)

Build a small CLI tool called `tagstore` with argparse that manages a JSON file
of tags:

```bash
tagstore add "deployment" --color blue
tagstore list
tagstore list --color blue
tagstore show "deployment"
tagstore remove "deployment"
tagstore export --format json     # JSON to stdout
tagstore export --format csv      # CSV to stdout
tagstore import -                 # JSON from stdin
```

Requirements:

1. Data stored in `~/.tagstore.json`
2. Three subcommands minimum: `add`, `list`, `show`
3. `--json` output mode on `list` and `show`
4. `--quiet` mode (exit code only)
5. Proper exit codes: 0 success, 1 error, 2 usage
6. Atomic writes (temp + rename)
7. `import -` reads from stdin (the Unix convention)

Write tests that invoke the tool via subprocess and verify outputs and exit codes.

---

## Challenge: uv Script with Inline Dependencies (~20 min)

Write a single-file Python script `fetch_status.py` that:

1. Uses PEP 723 metadata to declare dependencies on `requests` and `rich`
2. Has the `#!/usr/bin/env -S uv run --script` shebang
3. Takes a URL as a positional argument (or reads URLs from stdin, one per line)
4. Fetches each URL and prints status code + response time
5. Uses `rich` for colored terminal output (with `isatty()` detection)
6. Has a `--json` flag for machine-readable output

```bash
# Make it executable
chmod +x fetch_status.py

# Run directly (uv handles dependencies)
./fetch_status.py https://example.com https://httpbin.org/status/404

# Read URLs from a file
cat urls.txt | ./fetch_status.py -

# Machine-readable output
./fetch_status.py --json https://example.com | jq '.status'
```

Verify that `uv run --script fetch_status.py` works on a fresh machine with no
pre-installed packages.

---

## Challenge: Atomic YAML Editor (~45 min)

Write a Python CLI tool `yamlmod` that safely modifies YAML files:

```bash
# Set a value (dot-notation path)
yamlmod set config.yaml "server.port" 8080

# Get a value
yamlmod get config.yaml "server.port"

# Delete a key
yamlmod delete config.yaml "server.debug"

# List keys at a path
yamlmod keys config.yaml "server"
```

Requirements:

1. Atomic writes via temp + rename (from Step 3 and Section 6 above)
2. File locking with `fcntl.flock()` for concurrent access safety
3. Dot-notation path traversal for nested keys
4. Proper error messages when paths do not exist
5. `--json` output for `get` (outputs the value as JSON)
6. Reads from stdin if the file argument is `-`

Test it against the project's `docs/internal/backlog.yaml` - read a value, modify it,
verify the modification, then restore the original.

```python
import fcntl

def locked_read_modify_write(path, modifier_fn):
  """Read YAML, apply modifier, write atomically, with file locking."""
  with open(path, "r+") as f:
    fcntl.flock(f, fcntl.LOCK_EX)  # exclusive lock
    try:
      data = yaml.safe_load(f)
      modifier_fn(data)
      atomic_write(Path(path), yaml.dump(data, default_flow_style=False))
    finally:
      fcntl.flock(f, fcntl.LOCK_UN)
```

---

## Challenge: Notebook - Python Pipeline Explorer (~30 min)

Create a Jupyter notebook `docs/bootcamp/notebooks/pipeline-explorer.ipynb` that:

1. Demonstrates reading from stdin in Python with `%%bash` cells piping to Python cells
2. Shows side-by-side comparisons of shell pipelines vs Python equivalents
3. Processes the project's `docs/internal/backlog.yaml` with both YAML parsing and
   `grep` / `yq` approaches
4. Measures timing differences between shell and Python approaches for the same task
5. Includes a cell that invokes `bin/triangulate parse` via subprocess

Use this to explore when shell is faster to write, when Python is faster to write, and
when the answer depends on the complexity of the data.

---

## What to Read Next

[Step 6: Make/Just as Orchestrators](/bootcamp/06-make-just-orchestration/) - now that you
know how to write Python CLI tools and shell scripts, you need to know how to compose
them into repeatable build/test/deploy workflows. Make (and its modern successor Just)
solve the orchestration problem: declaring targets, dependencies between them, and
recipes that invoke your tools. The project's `Makefile` orchestrates everything -
gate checks, gauntlet runs, polecat dispatch - using exactly the tools from Steps 2-5.

The dependency chain: processes (Step 1) compose into shell (Step 2), which operates
on files (Step 3), which transforms text (Step 4), which sometimes needs Python
(Step 5). Step 6 is the layer that orchestrates all of these into a coherent build
system.

---

## Summary: The Decision Tree

```
Need to run a command and check if it worked?
  -> Shell

Need to pipe program A's output to program B?
  -> Shell

Need to transform text line by line with simple patterns?
  -> Shell (grep/sed/awk from Step 4)

Need to process structured data (JSON/YAML) with logic?
  -> Python

Need data structures beyond strings?
  -> Python

Over 30 lines and growing?
  -> Python

Need tests?
  -> Python

Need to call an external tool from Python?
  -> subprocess.run() with list-form args

Need inline dependencies with no project setup?
  -> PEP 723 + uv run --script

Need subcommands?
  -> argparse subparsers
```

The boundary is not about preference. It is about selecting the tool whose strengths
match the problem's requirements. Shell composes processes. Python composes data
structures. Know which problem you have.
