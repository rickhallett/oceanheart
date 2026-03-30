+++
title = "Tool Design and Agent-Computer Interfaces"
date = "2026-03-10"
description = "ACI design, poka-yoke for tools, MCP, tool result injection. The agent's empirical contact with reality."
tags = ["tools", "aci", "mcp", "bootcamp"]
step = 5
tier = 2
estimate = "4-5 hours"
bootcamp = 2
+++

Step 5 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This Step Exists

Tools are the model's only empirical contact with reality. When an LLM runs a shell
command, reads a file, queries a database, or executes a test suite, it is making an L7
tool call - the one layer in the entire stack where the model can verify something rather
than infer it. Without tools, a model is a closed system generating tokens from weights
and context. With tools, it can read the filesystem, observe process output, and check its
own work against external state. This is not a minor feature. It is the difference between
a language model and an agent.

Poor tool design is the most common source of agent failure in production. Anthropic's
engineering team, building their SWE-bench agent, found they "spent more time optimizing
tools than the overall prompt." This is a counterintuitive finding for most practitioners,
who assume the system prompt is the primary engineering surface. The tool schema is at
least as important - and for tool-heavy agents, it is more important.

Enterprise systems compound the stakes. Existing APIs, databases, CI/CD pipelines, and
security boundaries are not greenfield designs. Agent tools must integrate with these
systems without creating new attack surfaces. A tool that lets an agent execute arbitrary
SQL against a production database is not a tool - it is a vulnerability. Tool design is
where the engineering discipline of agentic systems meets the operational reality of
existing infrastructure.

> **FIELD MATURITY: EMERGING.** Anthropic introduced the Agent-Computer Interface (ACI)
> concept in December 2024. MCP (Model Context Protocol) is standardised and gaining
> broad adoption. OpenAI and Anthropic both publish function calling documentation. But
> tool design as a formal engineering discipline is still forming. The field provides
> the protocol layer (how tools are called) and initial design principles (poka-yoke,
> descriptive schemas). This step adds: L7 as the model's only empirical contact with
> reality, the context cost of tool results, the gate-as-a-tool pattern, and git as
> an audit channel.

The goal: build the judgment to design tools that make correct use easy and incorrect use
structurally impossible, while managing the context budget cost of every tool invocation.

---

## Table of Contents

1. [L7: The Tool Calling Layer](#1-l7-the-tool-calling-layer) (~25 min)
2. [Tool Design as Engineering](#2-tool-design-as-engineering) (~30 min)
3. [The Tool Schema as Contract](#3-the-tool-schema-as-contract) (~40 min)
4. [Poka-Yoke for Tools](#4-poka-yoke-for-tools) (~35 min)
5. [Read-Only vs Write Tools](#5-read-only-vs-write-tools) (~30 min)
6. [Tool Result Injection and Context Cost](#6-tool-result-injection-and-context-cost) (~35 min)
7. [MCP: The Model Context Protocol](#7-mcp-the-model-context-protocol) (~30 min)
8. [Verification Tools: The Gate as a Tool](#8-verification-tools-the-gate-as-a-tool) (~30 min)
9. [Git as Audit Channel](#9-git-as-audit-channel) (~25 min)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. L7: The Tool Calling Layer

*Estimated time: 25 minutes*

Step 2 covered L6 - the harness that orchestrates LLM calls, manages routing, and provides
the kill switch. L7 sits directly above it: "Model requests tool calls. Harness executes.
Results injected back into context."

This three-step cycle is the mechanical foundation of all tool use:

1. **Model emits a tool call.** During generation (L4), the model produces a structured
   output indicating it wants to invoke a specific tool with specific parameters. The
   generation stops. The model does not execute anything.

2. **Harness executes the tool.** The L6 harness receives the tool call, validates it
   against the registered tool schema, and runs the underlying implementation. The model
   is not involved in execution. It never sees your filesystem, your network, your
   database directly. The harness mediates everything.

3. **Result is injected back into context.** The tool output becomes a new message in
   the conversation, appended to the context window. The model processes this result at
   the next generation step and decides what to do next: call another tool, generate a
   response, or stop.

### The Empirical Contact Point

Most layers in the model stack are closed systems. L0 weights are frozen. L2 attention
operates on tokens already in context. L4 generation is autoregressive over what exists.
L7 is different: it is the one layer where information from outside the model enters the
conversation during runtime. Not from training data (L0), not from the user's message
(already in context), but from the actual current state of an external system.

When a model calls a tool that reads `/proc/self/status`, the result reflects the real
state of the process at that moment. When it calls `git diff`, the output shows the actual
uncommitted changes. When it runs a test suite, the pass/fail results are ground truth
about the code, not the model's opinion about the code.

This makes L7 the verification channel. The standing order "do not infer what you can
verify" is operationalised through tools. An agent that checks whether a file exists by
reading it (L7) is doing engineering. An agent that assumes a file exists because it was
mentioned in the conversation is guessing.

### The Cost

Every tool result costs context budget. A `git diff` that returns 500 lines consumes those
tokens from the context window. A file read that returns 2,000 lines consumes those tokens.
Heavy tool use accelerates L3 saturation - the context window fills with tool results,
leaving less room for reasoning, instructions, and conversation history.

This is not a reason to avoid tools. It is a reason to design tools that return concise,
information-dense results. The engineering trade-off at L7: more empirical grounding
(good) at the cost of more context consumption (budgeted, not free).

```
L6 HARNESS              L7 TOOL CALLING              EXTERNAL SYSTEM
    |                       |                              |
    |  1. Model emits       |                              |
    |  tool_call(name,      |                              |
    |  parameters)          |                              |
    |---------------------> |                              |
    |                       |  2. Harness validates        |
    |                       |  and executes                |
    |                       |----------------------------> |
    |                       |                              |
    |                       |  3. System returns result    |
    |                       | <--------------------------- |
    |                       |                              |
    |  4. Result injected   |                              |
    |  into context         |                              |
    | <-------------------  |                              |
    |                       |                              |
    |  5. Model processes   |                              |
    |  result, generates    |                              |
    |  next action          |                              |
```

> **AGENTIC GROUNDING:** When debugging an agent that produces incorrect output, ask: "Did
> the agent verify this via a tool call, or did it infer it from context?" Check the tool
> call history. If the agent made a claim about the filesystem without reading the filesystem,
> the claim is inference, not observation. L7 tool calls are the only way to distinguish
> agent knowledge (from training, from context) from agent observation (from the current
> state of the system). The absence of a verification tool call is itself diagnostic
> information.

---

## 2. Tool Design as Engineering

*Estimated time: 30 minutes*

Most practitioners treat tool definitions as boilerplate - write a quick JSON schema,
give it a short description, move on to the "real work" of prompt engineering. Anthropic's
SWE-bench experience refutes this directly: they spent more time optimising tools than the
overall prompt.

This is the ACI principle. Anthropic: "One rule of thumb is to think about how much effort
goes into human-computer interfaces (HCI), and plan to invest just as much effort in
creating good agent-computer interfaces (ACI)."

### Why ACI Matters More Than You Think

Consider a human using a CLI tool. The human has:

- **Man pages and documentation** outside the tool itself
- **Prior experience** with similar tools
- **Error recovery** - ability to read an error message, search the internet, try again
- **Context** - understanding of the current directory, the project structure, what they
  are trying to accomplish

A model using a tool has:

- **The tool definition in the context window.** That is it.
- No man pages, no internet search, no prior experience with this specific tool
- Error messages are injected as tool results, consuming more context budget
- Whatever context the system prompt and conversation provide

The tool definition IS the documentation, the interface, and the specification. If the
definition says `"q": "query"`, the model knows nothing about what constitutes a good
query, what the search syntax is, or what the results look like. If the definition says
`"query": "A regex pattern to search file contents. Use \\b for word boundaries. Returns
file paths and line numbers, sorted by modification time"`, the model can construct
effective queries.

### The Investment Hierarchy

Where engineering time produces the highest return in agent systems:

| Investment | Impact | Why |
|-----------|--------|-----|
| Tool schema design | Highest | Model's only interface to each capability |
| System prompt | High | Frames all reasoning |
| Prompt wording | Medium | Marginal improvements |
| Temperature tuning | Low | Stochastic, not structural |

This ordering surprises most practitioners because they start with prompts and add tools
as an afterthought. The practitioners who build production agent systems converge on the
opposite ordering: tools first, prompt second.

> **HISTORY:** The term "poka-yoke" comes from Shigeo Shingo's work at Toyota in the 1960s.
> It means "mistake-proofing" - designing processes and interfaces so that errors are
> physically impossible. A microwave that will not start with the door open is poka-yoke.
> A USB-C connector that fits either way up is poka-yoke. The concept was formalised in
> Shingo's 1986 book "Zero Quality Control: Source Inspection and the Poka-Yoke System."
> Anthropic adopted the term explicitly in their ACI guidance, applying a 60-year-old
> manufacturing quality concept to LLM tool design - the same underlying principle, a new
> domain.

> **AGENTIC GROUNDING:** If an agent systematically misuses a tool - calling it with wrong
> parameters, selecting it when another tool is appropriate, or misinterpreting its results -
> check the tool definition before blaming the model. In Anthropic's experience, the
> highest-impact fix for SWE-bench performance was a poka-yoke constraint (absolute paths
> only), not a prompt change. The tool definition is the primary engineering surface for
> tool-use reliability.

---

## 3. The Tool Schema as Contract

*Estimated time: 40 minutes*

A tool schema is a contract between the model and the system. The model promises to
provide parameters matching the schema. The system promises to execute the tool and
return a result. Like any contract, the quality of the agreement determines the quality
of the collaboration.

### Anatomy of a Tool Schema

Every major provider uses a variant of JSON Schema for tool definitions. The structure is
consistent across OpenAI, Anthropic, and MCP:

```json
{
  "name": "tool_name",
  "description": "What this tool does and when to use it.",
  "input_schema": {
    "type": "object",
    "properties": {
      "parameter_name": {
        "type": "string",
        "description": "What this parameter means and how to fill it."
      }
    },
    "required": ["parameter_name"]
  }
}
```

Each field is a lever. Get any of them wrong and the model will misuse the tool.

### The Name

The tool name is the first signal the model uses when selecting which tool to call. It
should be a verb-noun pair that describes the action and the domain:

| Bad | Good | Why |
|-----|------|-----|
| `search` | `search_codebase` | Domain specificity |
| `run` | `run_test_suite` | Action specificity |
| `get` | `read_file_contents` | Describes what is returned |
| `do_thing` | `execute_shell_command` | Communicates what happens |
| `util` | `format_code_block` | Names the capability |

When a model has 10 tools available, the name is how it discriminates. `search` and
`find` are ambiguous. `search_file_contents` and `find_files_by_pattern` are not.

### The Description

The description is the most underused field in tool design. Most definitions provide one
sentence. Effective definitions provide a paragraph that covers:

1. **What the tool does** - the primary action
2. **When to use it** - selection guidance ("Use this when you need to...")
3. **What it returns** - the shape and content of the result
4. **What it does NOT do** - disambiguation from similar tools
5. **Edge cases** - what happens with empty inputs, too many results, errors

```json
{
  "name": "read_file",
  "description": "Reads the contents of a file from the local filesystem. Returns the file contents with line numbers. Use this when you need to examine source code, configuration files, or any text file. For binary files, returns an error. For files longer than 2000 lines, returns the first 2000 lines - use the offset parameter to read beyond that point. If the file does not exist, returns an error message, not an exception."
}
```

Compare to: `"description": "Read a file."` The model knows nothing about line numbers,
truncation behaviour, binary file handling, or error semantics. Every missing detail is
a potential failure point.

### Parameter Design

Parameters are where most tool-use errors originate. Four principles:

**1. Descriptive names.** `filePath` not `f`. `searchPattern` not `q`. The model attends
to parameter names during generation. Short names provide less signal.

**2. Explicit types.** `"type": "integer"` not `"type": "string"` for a number. Type
mismatches are the most common tool-call error, and they are preventable at the schema
level.

**3. Constrained values.** Use `enum` wherever the valid values are a closed set:

```json
{
  "searchType": {
    "type": "string",
    "enum": ["text", "file", "symbol"],
    "description": "The type of search to perform. 'text' searches file contents with regex. 'file' matches file paths with glob patterns. 'symbol' searches for function, class, and variable definitions."
  }
}
```

With an enum, the model cannot send `"searchType": "full text"` or `"searchType": "grep"`.
The invalid values are structurally impossible.

**4. Documentation in descriptions.** Each parameter description should answer: what does
this parameter control, what format should the value be in, and what happens at the
boundaries?

```json
{
  "offset": {
    "type": "integer",
    "description": "The 0-based line number to start reading from. Defaults to 0 (beginning of file). Use this to read large files in chunks: first call with no offset, then call again with offset=2000 to read the next section.",
    "default": 0
  }
}
```

### Required vs Optional Parameters

Mark parameters as `required` when the tool cannot function without them. Mark them as
optional with defaults when there is a sensible default value:

```json
{
  "type": "object",
  "properties": {
    "command": {
      "type": "string",
      "description": "The bash command to execute. Required."
    },
    "workdir": {
      "type": "string",
      "description": "Working directory for the command. Defaults to the project root. Use this instead of 'cd dir && command'."
    },
    "timeout": {
      "type": "integer",
      "description": "Timeout in milliseconds. Default 120000 (2 minutes). Set higher for long-running commands like test suites.",
      "default": 120000
    }
  },
  "required": ["command"]
}
```

The `workdir` parameter is optional because the default (project root) is almost always
correct. The `timeout` parameter is optional because the default covers most cases. Making
every parameter required forces the model to specify values it does not need to think
about, increasing the probability of error.

### A Complete Example

Here is a fully specified tool schema for a file editing tool:

```json
{
  "name": "edit_file",
  "description": "Performs an exact string replacement in a file. Finds oldString in the file and replaces it with newString. The replacement is exact - oldString must appear in the file exactly as specified, including whitespace and indentation. If oldString is not found, the edit fails with an error. If oldString appears multiple times, the edit fails - provide more surrounding context to make the match unique, or use replaceAll to change every instance.",
  "input_schema": {
    "type": "object",
    "properties": {
      "filePath": {
        "type": "string",
        "description": "The absolute path to the file to modify. Must be absolute (starting with /), not relative. Example: /home/user/project/src/auth.ts"
      },
      "oldString": {
        "type": "string",
        "description": "The exact text to find and replace. Must match the file contents exactly, including indentation. Must be different from newString."
      },
      "newString": {
        "type": "string",
        "description": "The replacement text. The entire oldString match is replaced with this text."
      },
      "replaceAll": {
        "type": "boolean",
        "description": "If true, replaces all occurrences of oldString. If false (default), requires oldString to appear exactly once.",
        "default": false
      }
    },
    "required": ["filePath", "oldString", "newString"]
  }
}
```

This schema encodes multiple poka-yoke decisions:
- `filePath` must be absolute (documented in description)
- `oldString` must match exactly (no regex, no fuzzy matching)
- Multiple matches fail explicitly rather than replacing the wrong one
- `replaceAll` is opt-in, not the default

Each of these decisions prevents a class of errors.

> **AGENTIC GROUNDING:** Write tool schemas the way you write API contracts for external
> consumers. The model is a consumer of your tool API. It does not read your source code,
> your README, or your tests. The schema is the only interface documentation it will ever
> see. Every ambiguous parameter description, every missing type constraint, every
> undocumented edge case is a potential production failure. Invest the time.

---

## 4. Poka-Yoke for Tools

*Estimated time: 35 minutes*

Poka-yoke means making mistakes structurally impossible rather than relying on instructions
to prevent them. In tool design for agents, this is the highest-leverage design principle.
A model that cannot send an invalid value will not send an invalid value. A model that is
told not to send an invalid value sometimes will.

### The Anthropic SWE-bench Example

Anthropic's SWE-bench agent made systematic mistakes with file paths. After changing
directories, the agent used relative paths that resolved incorrectly. The team tried
prompt-level fixes: "Always use absolute paths." The errors continued. The fix that
worked: require absolute paths in the tool definition. The parameter validation rejects
relative paths before execution. Result: "the model used this method flawlessly."

This is poka-yoke in action. The instruction "always use absolute paths" is a paper
guardrail. The validation that rejects relative paths is a real guardrail.

### Seven Concrete Poka-Yoke Patterns

**1. Absolute paths instead of relative paths.**

```json
{
  "filePath": {
    "type": "string",
    "description": "Absolute path to the file. Must start with /. Relative paths will be rejected.",
    "pattern": "^/"
  }
}
```

Validation at the handler:

```python
#!/usr/bin/env python3
def validate_file_path(path: str) -> str:
  if not path.startswith("/"):
    raise ValueError(
      f"filePath must be absolute (start with /). Got: {path}"
    )
  # Resolve symlinks and .. to prevent path traversal
  resolved = os.path.realpath(path)
  if not resolved.startswith(ALLOWED_ROOT):
    raise ValueError(
      f"filePath must be within {ALLOWED_ROOT}. Resolved to: {resolved}"
    )
  return resolved
```

**2. Enums instead of free-form strings.**

Bad:
```json
{
  "action": {
    "type": "string",
    "description": "The action to perform: create, read, update, or delete."
  }
}
```

Good:
```json
{
  "action": {
    "type": "string",
    "enum": ["create", "read", "update", "delete"],
    "description": "The action to perform on the resource."
  }
}
```

With the bad version, the model might send `"action": "remove"`, `"action": "del"`, or
`"action": "DELETE"`. With the enum, only the four valid values are possible.

**3. Typed parameters instead of string-for-everything.**

Bad:
```json
{
  "maxResults": {
    "type": "string",
    "description": "Maximum number of results."
  }
}
```

Good:
```json
{
  "maxResults": {
    "type": "integer",
    "description": "Maximum number of results to return.",
    "minimum": 1,
    "maximum": 100,
    "default": 10
  }
}
```

The bad version accepts `"ten"`, `"10.5"`, `"-1"`, and `""`. The good version accepts
only integers in the valid range.

**4. Separate tools instead of mode parameters.**

Bad: one `database` tool with an `operation` parameter that accepts `"select"`, `"insert"`,
`"update"`, `"delete"`, `"drop"`, `"truncate"`.

Good: separate tools with distinct permissions:

```json
[
  {"name": "db_query", "description": "Execute a read-only SQL SELECT query..."},
  {"name": "db_insert", "description": "Insert a single row..."},
  {"name": "db_update", "description": "Update rows matching a WHERE clause..."}
]
```

No `db_drop`. No `db_truncate`. The destructive operations do not exist as tools. You
cannot misuse a tool that does not exist.

**5. Validation at the boundary, not in the handler.**

Validate parameters before execution, not during. If a parameter is invalid, fail
immediately with a clear error message. Do not let the tool partially execute with bad
inputs.

```python
#!/usr/bin/env python3
def execute_tool(name: str, params: dict) -> dict:
  # Validate BEFORE executing
  schema = TOOL_SCHEMAS[name]
  errors = validate_against_schema(params, schema)
  if errors:
    return {
      "error": f"Invalid parameters: {'; '.join(errors)}",
      "hint": "Check parameter types and required fields."
    }
  # Only execute after validation passes
  return TOOL_HANDLERS[name](**params)
```

**6. Confirmation for destructive operations.**

For tools that modify state (write files, delete resources, execute commands), require
explicit parameters that force the model to acknowledge the destructive nature:

```json
{
  "name": "delete_file",
  "description": "Permanently deletes a file. This cannot be undone. The file must exist.",
  "input_schema": {
    "type": "object",
    "properties": {
      "filePath": {
        "type": "string",
        "description": "Absolute path to the file to delete."
      },
      "confirmDeletion": {
        "type": "boolean",
        "description": "Must be set to true to confirm deletion. The tool will not execute without this confirmation."
      }
    },
    "required": ["filePath", "confirmDeletion"]
  }
}
```

The `confirmDeletion` parameter adds friction. The model must explicitly set it to `true`.
This does not prevent intentional deletions. It prevents accidental ones.

**7. Bounded output to prevent context flooding.**

Tools that return variable-length output should have built-in truncation:

```json
{
  "name": "search_codebase",
  "description": "Returns up to maxResults matches. If more matches exist, the result includes a 'truncated' flag and the total count.",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "Regex pattern to search for."
      },
      "maxResults": {
        "type": "integer",
        "default": 20,
        "maximum": 100,
        "description": "Maximum results to return. Default 20. Higher values consume more context window tokens."
      }
    },
    "required": ["pattern"]
  }
}
```

The `maximum: 100` prevents a model from requesting 10,000 results and flooding the context
window. The description warns about context cost, but the schema constraint enforces it.

### The Poka-Yoke Test

For every tool you design, ask: "What are the three most likely incorrect invocations?
Does the schema prevent them?"

If the answer is "the schema allows them but the description says not to" - that is a
paper guardrail. Replace it with a real one.

> **AGENTIC GROUNDING:** Poka-yoke is the single most effective tool design technique.
> Anthropic's highest-impact SWE-bench improvement was a poka-yoke constraint, not a prompt
> improvement. The principle: every class of error you can prevent at the schema level is a
> class of error you never need to debug in production. Invest your engineering time in
> constraints that make wrong tool calls impossible, not in instructions that ask the model
> to avoid them.

---

## 5. Read-Only vs Write Tools

*Estimated time: 30 minutes*

The principle of least privilege applies to agent tools with the same force it applies to
user permissions. An agent that can read the filesystem and run tests has a different risk
profile from an agent that can also write files, execute arbitrary commands, and delete
resources.

### The Read-Write Distinction

Tools fall into two categories with fundamentally different safety properties:

| Property | Read-Only Tools | Write Tools |
|----------|----------------|-------------|
| Idempotent | Yes - calling twice gives same result | No - calling twice may duplicate the action |
| Reversible | N/A - no state change | Depends on the operation |
| Risk | Information disclosure only | State corruption, data loss, security breach |
| Rate limit | Can be aggressive | Should be conservative |
| Verification | Result can be checked independently | May need rollback capability |

**Read-only tools** (safe to call freely):
- `read_file` - returns file contents
- `search_codebase` - finds files matching a pattern
- `run_test_suite` - executes tests (read-only on the codebase)
- `git_log` - shows commit history
- `git_diff` - shows uncommitted changes
- `list_directory` - shows directory contents

**Write tools** (require caution):
- `edit_file` - modifies file contents
- `write_file` - creates or overwrites a file
- `execute_command` - runs arbitrary shell commands
- `git_commit` - creates a commit
- `delete_file` - removes a file

### The "Do Not Infer What You Can Verify" Principle

This standing order from the project operationalises through the read-write distinction.
Verification is a read operation. The agent should use read tools liberally to confirm
state before using write tools to change it.

The correct pattern:

```
1. read_file("src/auth.ts")           # Verify current state
2. edit_file("src/auth.ts", old, new) # Make the change
3. read_file("src/auth.ts")           # Verify the change was applied
4. run_test_suite()                   # Verify nothing broke
```

The incorrect pattern:

```
1. edit_file("src/auth.ts", old, new) # Change without reading first
                                      # No verification afterward
```

The first pattern uses four tool calls. The second uses one. The first pattern catches
errors. The second hopes there are none.

### Least Privilege in Practice

Design tool sets that give agents the minimum capability needed for the task:

**Code review agent:** Read-only tool set. Can read files, search code, check types,
run tests. Cannot edit files, commit, or push. The review is purely observational.

```json
[
  {"name": "read_file", "description": "Read a file's contents..."},
  {"name": "search_codebase", "description": "Search for patterns..."},
  {"name": "run_typecheck", "description": "Run TypeScript type checker..."},
  {"name": "run_tests", "description": "Execute the test suite..."}
]
```

**Code editing agent:** Read-write tool set, but no deployment tools. Can read, edit,
test - cannot push to remote or deploy.

```json
[
  {"name": "read_file", "description": "Read a file's contents..."},
  {"name": "edit_file", "description": "Edit a file with exact replacement..."},
  {"name": "write_file", "description": "Create a new file..."},
  {"name": "run_tests", "description": "Execute the test suite..."},
  {"name": "git_commit", "description": "Create a local git commit..."}
]
```

**Deployment agent:** Separate agent, separate tool set, separate approval gate. This is
not the same agent that wrote the code.

The separation is intentional. An agent that can both write code and deploy it has an
unbroken path from "model generates wrong code" to "wrong code is in production." Breaking
that path at the tool level is a structural control, not a procedural one.

### Multi-Step Authorisation

For high-risk write operations, implement multi-step authorisation where the first call
prepares the operation and the second confirms it:

```python
#!/usr/bin/env python3
"""Multi-step delete with explicit confirmation."""

def handle_delete_prepare(file_path: str) -> dict:
  """Step 1: Show what will be deleted. Do not delete yet."""
  if not os.path.exists(file_path):
    return {"error": f"File does not exist: {file_path}"}
  stat = os.stat(file_path)
  return {
    "status": "pending_confirmation",
    "file": file_path,
    "size_bytes": stat.st_size,
    "last_modified": stat.st_mtime,
    "message": "Call delete_confirm with this file path to proceed."
  }

def handle_delete_confirm(file_path: str) -> dict:
  """Step 2: Execute the deletion after confirmation."""
  os.remove(file_path)
  return {"status": "deleted", "file": file_path}
```

The model must make two sequential tool calls. Between them, it processes the file metadata
and explicitly decides to proceed. This is not foolproof - the model may proceed
automatically - but it creates a checkpoint that the Operator can observe in the tool call
history.

> **AGENTIC GROUNDING:** When reviewing an agent's tool call history, count the ratio of
> read calls to write calls. A healthy ratio for a code editing agent is roughly 3:1 or
> higher - reading, searching, and verifying significantly more than writing. An agent that
> writes more than it reads is operating on inference, not observation. The read-write
> ratio is a diagnostic metric for agent discipline.

---

## 6. Tool Result Injection and Context Cost

*Estimated time: 35 minutes*

Every tool result is injected into the context window as a message. This is the mechanism
that makes tools useful - the model can see the result and reason about it. It is also the
mechanism that makes tools expensive - every result consumes context budget.

### The Cost Equation

A single tool call that reads a file and returns 200 lines of code consumes roughly
800-1,200 tokens. An agent that reads 10 files to understand a codebase before making a
change has consumed 8,000-12,000 tokens on tool results alone. Add the system prompt
(500-2,000 tokens), the conversation history (variable), and the tool schemas themselves
(50-200 tokens per tool), and the context window fills quickly.

```
Context budget allocation (typical 128k-200k token window):

System prompt + tool schemas:   2,000-5,000 tokens    (~2-4%)
Conversation history:           5,000-20,000 tokens    (~5-15%)
Tool results (accumulated):     20,000-100,000 tokens  (~15-75%)
Available for generation:       remainder
```

In tool-heavy workflows, tool results dominate the context window. This is the L3
connection from Step 1: "Heavy tool use accelerates saturation."

### Designing Concise Tool Results

The format of tool results is as important as the format of tool definitions. Every token
in a tool result that does not contribute to the model's next decision is waste.

**Problem: Returning full file contents when a summary would suffice.**

Bad - returning a 500-line file:
```
[Full contents of lib/auth/login.ts, 500 lines, ~2000 tokens]
```

Better - returning the relevant section:
```
lib/auth/login.ts (lines 45-60 of 500):
45: export async function validatePassword(
46:   input: string,
47:   hash: string
48: ): Promise<boolean> {
49:   return input === hash  // BUG: not timing-safe
50: }
```

**Problem: Returning verbose command output.**

Bad - returning unfiltered test output:
```
PASS lib/auth/__tests__/login.test.ts
  validatePassword
    ✓ returns true for matching password (3 ms)
    ✓ returns false for non-matching password (1 ms)
    ✓ handles empty string input (1 ms)
PASS lib/auth/__tests__/session.test.ts
  createSession
    ✓ creates session with valid token (5 ms)
    ✓ rejects expired token (2 ms)
... [200 more lines of passing tests]
FAIL lib/bouts/__tests__/scoring.test.ts
  calculateScore
    ✗ handles edge case with zero rounds (4 ms)
      Expected: 0
      Received: NaN
```

Better - returning a structured summary:
```json
{
  "passed": 47,
  "failed": 1,
  "total": 48,
  "failures": [
    {
      "file": "lib/bouts/__tests__/scoring.test.ts",
      "test": "calculateScore > handles edge case with zero rounds",
      "expected": "0",
      "received": "NaN"
    }
  ]
}
```

The verbose output costs 200+ lines of tokens. The structured summary costs 15 lines and
contains all the information the model needs to act: which test failed, where, and what
the assertion mismatch was.

### Truncation Strategies

Large results need truncation. Three strategies:

**1. Line-limited with continuation.** Return the first N lines with a note:

```
Showing first 50 of 347 results. Use offset parameter to see more.
```

This lets the model decide whether to read more. Most of the time, the first page is enough.

**2. Structured summary with details on demand.** Return a summary first, let the model
request details:

```json
{
  "matchCount": 347,
  "topResults": [
    {"file": "lib/auth/login.ts", "line": 49, "match": "input === hash"},
    {"file": "lib/auth/session.ts", "line": 12, "match": "token === stored"}
  ],
  "truncated": true,
  "message": "347 matches found. Showing top 2. Increase maxResults to see more."
}
```

**3. Diff instead of full content.** When the model needs to see what changed, return a
diff instead of the full file:

```diff
--- a/lib/auth/login.ts
+++ b/lib/auth/login.ts
@@ -47,3 +47,5 @@
 ): Promise<boolean> {
-  return input === hash
+  const crypto = await import('crypto')
+  return crypto.timingSafeEqual(
+    Buffer.from(input), Buffer.from(hash)
+  )
 }
```

The diff shows the change in 8 lines. The full file would be 500. For verification
purposes - "did the edit apply correctly?" - the diff is strictly superior.

### The Format Problem

Different consumers need different formats for the same data:

| Consumer | Best Format | Why |
|----------|------------|-----|
| Model reasoning about code | Full source with line numbers | Needs context for analysis |
| Model verifying an edit | Diff | Needs to see what changed, not everything |
| Model finding a function | File path + line number | Just needs the location |
| Model debugging a test failure | Structured JSON summary | Needs assertion details, not passing tests |

Design tools with multiple output formats, or design separate tools for different
information needs. A `read_file` tool and a `get_file_summary` tool serve different
purposes. Making the model read a full 2,000-line file when it only needs to know if a
function exists is a context budget waste.

> **AGENTIC GROUNDING:** When an agent's performance degrades over a long session, check
> the context window utilisation. If tool results are consuming 60%+ of the available
> context, the model has less room for reasoning and instruction following. The fix is not
> to use fewer tools - tools are how the agent verifies. The fix is to design tool results
> that are concise and information-dense. Structured summaries instead of raw output. Diffs
> instead of full files. Line-limited results with continuation instead of unbounded dumps.
> Context budget is finite. Spend it on signal, not noise.

---

## 7. MCP: The Model Context Protocol

*Estimated time: 30 minutes*

MCP (Model Context Protocol) is an open-source standard for connecting AI applications to
external systems. Anthropic introduced it to solve the integration fragmentation problem:
every model provider had its own tool-calling format, every application built its own
connectors, and every tool was reimplemented per client.

### What MCP Standardises

MCP defines a client-server architecture:

- **MCP Client:** The AI application (Claude, ChatGPT, VS Code, Cursor, or your custom agent)
- **MCP Server:** A process that exposes tools, resources, and prompts over a standardised protocol
- **Transport:** Communication between client and server (stdio for local, HTTP+SSE for remote)

```
+-----------+        MCP Protocol        +-----------+
|           | <----------------------->  |           |
| MCP Client|     (JSON-RPC 2.0)        | MCP Server|
| (Agent)   |                           | (Tools)   |
|           |                           |           |
+-----------+                           +-----------+
      |                                       |
      v                                       v
  LLM / Harness                      External Systems
                                     (filesystem, DB,
                                      APIs, git, etc.)
```

### The Analogy

Anthropic describes MCP as "a USB-C port for AI applications." Before USB-C, every device
had its own connector. You needed a drawer full of cables. USB-C standardised the physical
and protocol layer. You still need to build the device, but you do not need to reinvent
the connector.

MCP does the same for tool integration. You still need to design good tools (this step).
But you do not need to implement a different tool-calling protocol for every client.

### MCP Server Structure

An MCP server exposes three types of capabilities:

**Tools** - functions the model can call:

```json
{
  "name": "query_database",
  "description": "Execute a read-only SQL query against the project database.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sql": {
        "type": "string",
        "description": "A SELECT query. Only SELECT is allowed."
      }
    },
    "required": ["sql"]
  }
}
```

**Resources** - data the model can read (files, database records, API responses):

```json
{
  "uri": "file:///project/config.yaml",
  "name": "Project Configuration",
  "mimeType": "text/yaml"
}
```

**Prompts** - reusable prompt templates for common operations:

```json
{
  "name": "code_review",
  "description": "Review code for security and correctness issues",
  "arguments": [
    {"name": "file_path", "description": "Path to the file to review"}
  ]
}
```

### Building a Minimal MCP Server

A minimal MCP server in Python using the official SDK:

```python
#!/usr/bin/env python3
"""Minimal MCP server that exposes a file reading tool."""
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio

server = Server("file-reader")

@server.list_tools()
async def list_tools() -> list[Tool]:
  return [
    Tool(
      name="read_file",
      description="Read contents of a file. Returns text with line numbers.",
      inputSchema={
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "Absolute path to the file to read."
          }
        },
        "required": ["path"]
      }
    )
  ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
  if name == "read_file":
    path = arguments["path"]
    if not path.startswith("/"):
      return [TextContent(
        type="text",
        text=f"Error: path must be absolute. Got: {path}"
      )]
    try:
      with open(path, "r") as f:
        lines = f.readlines()
      numbered = [
        f"{i+1:4d}| {line}" for i, line in enumerate(lines[:2000])
      ]
      result = "".join(numbered)
      if len(lines) > 2000:
        result += f"\n... truncated ({len(lines)} total lines)"
      return [TextContent(type="text", text=result)]
    except FileNotFoundError:
      return [TextContent(
        type="text",
        text=f"Error: file not found: {path}"
      )]
  return [TextContent(type="text", text=f"Unknown tool: {name}")]

async def main():
  async with mcp.server.stdio.stdio_server() as (read, write):
    await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
  import asyncio
  asyncio.run(main())
```

This server:
- Exposes one tool: `read_file`
- Validates the path is absolute (poka-yoke)
- Truncates results at 2,000 lines (context budget protection)
- Returns clear error messages for missing files
- Communicates over stdio (standard for local MCP servers)

### What MCP Does Not Solve

MCP standardises the transport. It does not standardise the quality. A bad tool exposed
over MCP is still a bad tool. Specifically:

- **MCP does not enforce good schema design.** A tool with `"q": "string"` is valid MCP.
- **MCP does not enforce poka-yoke.** Relative paths, unbounded results, missing
  validations - all valid MCP.
- **MCP does not manage context cost.** A tool that returns 50,000 tokens is a valid
  MCP response.
- **MCP does not enforce least privilege.** A server that exposes `DROP TABLE` is valid MCP.

MCP solves the integration problem. The design problems from Sections 2-5 of this step
still require engineering judgment.

> **HISTORY:** MCP was introduced by Anthropic in late 2024 and gained rapid adoption
> through 2025. By early 2026, it is supported by Claude, ChatGPT, VS Code, Cursor, and
> dozens of other AI clients. The protocol uses JSON-RPC 2.0 as its wire format - a
> standard from 2010 that predates the LLM era by over a decade. The choice of an
> established wire format over a novel one is itself a design principle: standardise the
> transport, innovate on the capabilities.

> **AGENTIC GROUNDING:** MCP is the interoperability layer. Write tools once, use them
> across clients. But do not confuse MCP adoption with tool quality. An MCP server with
> poorly designed tools will fail across all clients equally. The design principles from
> this step - descriptive schemas, poka-yoke constraints, bounded output, least privilege -
> apply regardless of whether the tool is exposed through MCP, direct function calling, or
> a custom protocol. Protocol is plumbing. Design is engineering.

---

## 8. Verification Tools: The Gate as a Tool

*Estimated time: 30 minutes*

The quality gate - `pnpm run typecheck && pnpm run lint && pnpm run test` or equivalent -
is normally described as something the developer runs after making changes. In agentic
workflows, the gate is not separate from the agent. It is a tool the agent uses as part of
its work loop.

### Why Verification Tools Are Different

Most tools let the agent act on the environment: read files, edit code, search for
patterns. Verification tools let the agent check its own work. This creates a feedback
loop within the tool-use cycle:

```
1. Read the code          (observation)
2. Edit the code          (action)
3. Run the type checker   (verification)
4. If errors, read them   (observation)
5. Edit to fix            (action)
6. Run type checker again (verification)
7. Run the test suite     (verification)
8. If failures, read them (observation)
9. Edit to fix            (action)
10. Run tests again       (verification)
```

This is the engineering loop - Read, Verify, Write, Execute, Confirm - implemented through
tools. The agent does not need the Operator to tell it the type checker failed. The tool
result tells the agent directly. This is L7 providing empirical feedback that the model
uses to correct its own output.

### Designing Verification Tools

Verification tools have specific design requirements:

**1. Structured failure output.** The tool result for a failing test must include enough
information for the model to diagnose and fix the issue:

```json
{
  "name": "run_typecheck",
  "description": "Runs the TypeScript type checker (tsc --noEmit). Returns structured results: either a clean pass or a list of type errors with file, line, and error message. Use this after editing TypeScript files to verify type safety."
}
```

Tool result for failures:

```json
{
  "status": "failed",
  "errorCount": 2,
  "errors": [
    {
      "file": "lib/auth/login.ts",
      "line": 49,
      "code": "TS2345",
      "message": "Argument of type 'string' is not assignable to parameter of type 'Buffer'."
    },
    {
      "file": "lib/auth/login.ts",
      "line": 50,
      "message": "Property 'timingSafeEqual' does not exist on type 'typeof import(\"crypto\")'."
    }
  ]
}
```

**2. Pass/fail clarity.** The model should not need to parse prose to determine if
verification passed. A `"status": "passed"` or `"status": "failed"` field makes the
result unambiguous.

**3. Concise pass results.** When all tests pass, the result should be minimal:

```json
{
  "status": "passed",
  "testsRun": 48,
  "duration": "3.2s"
}
```

Not 200 lines of green checkmarks. The model does not need to see 48 passing test names.
It needs to know: did it pass?

**4. Actionable failure results.** When tests fail, the result must include the file, the
test name, the expected value, the actual value, and ideally the relevant line number.
Without these, the model cannot fix the failure without additional tool calls (reading the
test file, reading the source file), which cost more context.

### The Gate as a Compound Tool

In practice, the gate is multiple verification tools composed:

```json
[
  {
    "name": "run_typecheck",
    "description": "Run TypeScript type checking. Fast (seconds). Run after every edit."
  },
  {
    "name": "run_lint",
    "description": "Run ESLint. Fast (seconds). Run after every edit."
  },
  {
    "name": "run_tests",
    "description": "Run the full test suite with Vitest. Slower (10-30 seconds). Run after completing a logical unit of changes, not after every single edit."
  },
  {
    "name": "run_gate",
    "description": "Run the full quality gate: typecheck, lint, and test in sequence. Equivalent to running typecheck, lint, and tests separately. Use this for final verification before committing."
  }
]
```

The separation matters. Running the full gate after every small edit is wasteful. Running
the type checker alone after each edit catches most regressions quickly. The full gate
runs before commit as the final check.

The `run_gate` tool encapsulates the standing rule: "If the gate fails, the change is not
ready."

### The Self-Correcting Agent

An agent with verification tools can self-correct without human intervention:

```
Agent: edit_file("lib/auth/login.ts", old_code, new_code)
Agent: run_typecheck()
Result: {"status": "failed", "errors": [{"line": 49, "message": "..."}]}
Agent: read_file("lib/auth/login.ts", offset=45, limit=10)
Agent: edit_file("lib/auth/login.ts", incorrect_import, correct_import)
Agent: run_typecheck()
Result: {"status": "passed"}
Agent: run_tests()
Result: {"status": "passed", "testsRun": 48}
```

The agent made an error, detected it through a verification tool, diagnosed the issue,
fixed it, and verified the fix. This is "do not infer what you can verify" in action. The
model did not guess whether the code was correct. It checked.

> **AGENTIC GROUNDING:** The gate is not something you run after the agent finishes. It is
> a tool the agent uses during its work. An agent without access to the type checker,
> linter, and test runner is operating blind - generating code and hoping it works. An agent
> with verification tools can catch and fix its own errors. The difference in output quality
> is not marginal. It is the difference between "probably correct" and "verified correct."
> When designing agent tool sets, verification tools are not optional extras. They are the
> core capability that makes the agent's output trustworthy.

---

## 9. Git as Audit Channel

*Estimated time: 25 minutes*

Git is usually thought of as a write tool - `add`, `commit`, `push`. For agentic systems,
git is equally important as a read tool and an audit channel. Every commit is a signed
record of what changed, when, and by whom. The git log is a queryable audit trail that
persists beyond any context window.

### Git Read Tools

**`git diff`** - shows uncommitted changes. The agent can verify what it has actually
changed versus what it intended to change:

```json
{
  "name": "git_diff",
  "description": "Shows unstaged changes in the working directory. Returns a unified diff. Use this to verify what has changed before committing. If no changes exist, returns empty string."
}
```

**`git log`** - shows commit history. The agent can understand what work has already been
done:

```json
{
  "name": "git_log",
  "description": "Shows recent commit history. Returns the last N commits with hash, author, date, and message. Default 10 commits.",
  "input_schema": {
    "type": "object",
    "properties": {
      "count": {
        "type": "integer",
        "default": 10,
        "description": "Number of recent commits to show."
      },
      "oneline": {
        "type": "boolean",
        "default": true,
        "description": "If true, shows one line per commit. If false, shows full commit messages."
      }
    }
  }
}
```

**`git blame`** - shows who last modified each line. The agent can trace the provenance of
specific code:

```json
{
  "name": "git_blame",
  "description": "Shows the last commit that modified each line in a file. Returns line number, commit hash, author, date, and the line content. Use this to understand the history and authorship of specific code."
}
```

**`git status`** - shows the current state of the working tree. Untracked files, staged
changes, uncommitted modifications:

```json
{
  "name": "git_status",
  "description": "Shows the current state of the git working tree: staged changes, unstaged changes, and untracked files. Use this to understand the current state before committing."
}
```

### The Audit Function

Every git commit records:
- **What changed** - the diff
- **When** - the timestamp
- **Who** - the author
- **Why** - the commit message
- **The tree state** - the complete content-addressed snapshot of the project

For agentic workflows, this audit trail has a specific property: "L7 results persist beyond
the context window that created them." When a context window dies (compaction), the
conversation is lost. But the commits survive. The next session can read `git log` and
`git diff` to reconstruct what happened.

### The Commit as Verification Record

A well-designed commit workflow creates audit records at verification points:

```
1. Agent makes changes
2. Agent runs the gate (typecheck + lint + test)
3. Gate passes
4. Agent commits with a descriptive message
5. The commit records: verified-working code at this point in time
```

If the gate fails later (after further changes), `git diff` against the last passing
commit shows exactly what broke. The commit history becomes a series of verified
checkpoints.

### Git Tools vs Arbitrary Shell Access

A common design question: should the agent have a general `execute_command` tool, or
specific git tools?

Specific git tools are better for three reasons:

1. **Poka-yoke.** A `git_commit` tool can require a message and validate it follows
   conventions. An `execute_command` tool lets the agent run `git commit --allow-empty -m ""`.

2. **Least privilege.** A `git_log` tool is read-only by definition. An `execute_command`
   tool lets the agent run `git push --force origin main`.

3. **Structured output.** A `git_log` tool can return structured JSON. An `execute_command`
   tool returns raw text that the model must parse.

The general-purpose shell command tool is useful as a fallback for operations without
dedicated tools. But for common operations like git, dedicated tools with built-in
constraints are safer and more reliable.

> **HISTORY:** Git was created by Linus Torvalds in 2005 as a content-addressable
> filesystem with a version control interface. The content-addressable property means
> every object (blob, tree, commit) is identified by its SHA hash. This makes the commit
> history tamper-evident: changing any commit changes its hash, which changes all
> subsequent hashes. For agent audit trails, this property is structural, not incidental.
> If an agent's commit history is intact, the audit trail is intact.

> **AGENTIC GROUNDING:** Git is the most underappreciated tool in the agent tool set.
> Most agent systems expose git only as a write tool (commit, push). Expose it as a read
> tool too: `git_diff`, `git_log`, `git_blame`, `git_status`. These read tools let the
> agent verify its own changes before committing, understand the project history before
> making decisions, and create audit records that survive context window death. The commit
> history is the durable record. When the context window is gone, the git log remains.

---

## Challenge: Design a File Search Tool

**Estimated time: 15 minutes**

**Goal:** Design a complete tool schema for a codebase search tool that demonstrates
good ACI design principles.

Design a JSON tool schema for a `search_codebase` tool that:
- Supports both text content search and file path matching
- Has a constrained search type parameter (enum)
- Limits maximum results (with a sensible default)
- Documents the return format in the description
- Uses descriptive parameter names

Write the complete JSON schema. Then review it against the poka-yoke checklist:
1. Can the model send an invalid search type? (Should be no, via enum)
2. Can the model request unlimited results? (Should be no, via maximum)
3. Are parameter names self-documenting? (Should be yes)
4. Does the description tell the model when to use this tool vs others? (Should be yes)

**Verification:** Your schema should have at least 3 parameters, use at least one enum,
include a `required` array, and have descriptions on all parameters that include usage
guidance.

<details>
<summary>Hints</summary>

A good search tool distinguishes between searching file *contents* (grep-like) and
searching file *paths* (glob-like). Consider parameters for: the search pattern, the
search type, maximum results, and optionally a directory scope or file type filter.

The description should say what the results look like: "Returns file paths and line
numbers, sorted by modification time."

</details>

**Extension:** Add a fourth parameter that limits results to specific file types
(e.g., `"include": "*.ts"`) and document when this is useful in the parameter description.

---

## Challenge: Poka-Yoke Audit

**Estimated time: 20 minutes**

**Goal:** Review an existing tool schema, identify error-prone parameters, and
redesign them with poka-yoke constraints.

Here is a tool schema with multiple design problems:

```json
{
  "name": "db",
  "description": "Database operations",
  "parameters": {
    "op": {
      "type": "string",
      "description": "operation"
    },
    "table": {
      "type": "string",
      "description": "table name"
    },
    "data": {
      "type": "string",
      "description": "data to insert or conditions"
    },
    "limit": {
      "type": "string",
      "description": "limit"
    }
  }
}
```

1. List every design problem you can find (aim for at least 6).
2. Redesign this as a set of tools that follow ACI design principles.

**Verification:** Your redesign should:
- Split this into at least 2 separate tools (read vs write)
- Use enums where applicable
- Use correct types (not string-for-everything)
- Have descriptive names and documentation
- Include a `required` array
- Make destructive operations harder to invoke than read operations

<details>
<summary>Hints</summary>

Problems to find: (1) tool name is cryptic, (2) description says nothing useful,
(3) `op` should be an enum or separate tools, (4) `table` is not validated, (5) `data`
is string instead of structured, (6) `limit` is string instead of integer, (7) no
`required` array, (8) no guidance on when to use this vs other tools, (9) no
documentation of return format, (10) a single tool handles both reads and writes.

</details>

---

## Challenge: Measure Context Cost of Tool Results

**Estimated time: 20 minutes**

**Goal:** Measure the token cost of different tool result formats for the same
information and calculate the context budget impact.

Take a real source file from any project (50-200 lines). Represent it in three formats:

1. **Full file with line numbers** (as `read_file` would return it)
2. **A 10-line excerpt** around a specific function (as a targeted read would return)
3. **A structured summary** (file name, line count, list of exported functions/classes
   with line numbers)

For each format:
- Estimate the token count (rule of thumb: 1 token per ~4 characters for code)
- Calculate what percentage of a 128k token context window each format consumes

**Verification:** You should find that:
- Full file: roughly 200-800 tokens for a typical source file
- Excerpt: roughly 40-80 tokens
- Summary: roughly 30-60 tokens
- The ratio between full file and summary is roughly 5:1 to 15:1

Now multiply by 10 (a typical number of files an agent reads in a session). The full-file
approach consumes 2,000-8,000 tokens. The summary approach consumes 300-600 tokens. For
a 128k context window, this is the difference between 1-6% and 0.2-0.5% of the budget.

**Extension:** If your agent reads 50 files in a session (common for large refactoring
tasks), calculate the context budget consumed by each strategy. At what point does the
full-file approach consume more than 25% of the context window?

---

## Challenge: Build an MCP Server

**Estimated time: 25 minutes**

**Goal:** Build a minimal MCP server that exposes one useful tool with proper
poka-yoke constraints.

Create an MCP server that exposes a `count_lines` tool. The tool:
- Takes an absolute file path (validate: must start with /)
- Takes an optional file extension filter (enum: "all", "ts", "py", "md", "json")
- If given a file, returns the line count
- If given a directory, returns line counts per file (limited to 50 files)
- Returns structured JSON output

Use the Python MCP SDK (`pip install mcp` or `uv add mcp`):

```python
#!/usr/bin/env python3
"""MCP server skeleton - implement the tool handler."""
from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.server.stdio
import os, json, asyncio

server = Server("line-counter")

@server.list_tools()
async def list_tools() -> list[Tool]:
  return [
    Tool(
      name="count_lines",
      description="Count lines in a file or directory. Returns structured JSON with file paths and line counts.",
      inputSchema={
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "Absolute path to a file or directory. Must start with /."
          },
          "extension": {
            "type": "string",
            "enum": ["all", "ts", "py", "md", "json"],
            "description": "File extension filter. Only counts files with this extension. 'all' counts all text files.",
            "default": "all"
          }
        },
        "required": ["path"]
      }
    )
  ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
  if name != "count_lines":
    return [TextContent(type="text", text=f"Unknown tool: {name}")]

  path = arguments["path"]
  ext = arguments.get("extension", "all")

  # Poka-yoke: absolute path validation
  if not path.startswith("/"):
    return [TextContent(type="text", text=json.dumps({
      "error": "Path must be absolute (start with /)",
      "received": path
    }))]

  # TODO: Implement the handler
  # If path is a file: count lines, return {"file": path, "lines": N}
  # If path is a directory: list files (filtered by ext),
  #   count lines in each (max 50 files),
  #   return {"directory": path, "files": [...], "total_lines": N}
  pass

async def main():
  async with mcp.server.stdio.stdio_server() as (read, write):
    await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
  asyncio.run(main())
```

Complete the `call_tool` handler. Test it by running the server and sending a request
through an MCP client, or by writing a simple test that calls `call_tool` directly.

**Verification:** Your implementation should:
- Return a valid JSON result for a file path
- Return a valid JSON result for a directory path
- Reject relative paths with a clear error message
- Limit directory results to 50 files
- Filter by extension when specified

<details>
<summary>Hints</summary>

For counting lines in a file:
```python
with open(path, "r") as f:
  line_count = sum(1 for _ in f)
```

For listing files in a directory with extension filter:
```python
ext_filter = f".{ext}" if ext != "all" else None
files = []
for entry in os.scandir(path):
  if entry.is_file():
    if ext_filter is None or entry.name.endswith(ext_filter):
      files.append(entry.path)
```

</details>

---

## Challenge: Gate Integration Workflow

**Estimated time: 20 minutes**

**Goal:** Design a tool-use workflow where an agent makes a code change, runs
verification tools, and self-corrects.

Write out the complete sequence of tool calls an agent should make to:

1. Read a file to understand the current code
2. Make an edit to fix a bug
3. Run the type checker
4. Handle a type error (if one occurs)
5. Run the test suite
6. Handle a test failure (if one occurs)
7. Commit the verified change

For each step, specify:
- The tool name
- The key parameters
- What the agent should look for in the result
- What the agent should do if the result indicates failure

Write this as a numbered sequence. Example format:

```
Step 1: read_file(filePath="/project/src/auth.ts")
  Look for: the function containing the bug
  On failure: report that the file does not exist

Step 2: edit_file(filePath="/project/src/auth.ts", oldString="...", newString="...")
  Look for: success confirmation
  On failure: read the file again to check for exact match issues
...
```

**Verification:** Your sequence should:
- Have at least 7 steps
- Include at least 2 verification tool calls (typecheck and test)
- Include a self-correction path for at least one verification failure
- End with a commit only after all verification passes
- Use read tools before write tools (verify before act)

**Extension:** Add a step where the agent checks `git_diff` before committing to verify
that only the intended changes are included (no unintended side effects from the edit).

---

## Challenge: Tool Result Optimisation

**Estimated time: 15 minutes**

**Goal:** Redesign a verbose tool result to be concise and information-dense.

Here is a raw test runner output (typical of what `execute_command("npm test")` returns):

```
> project@1.0.0 test
> vitest run

 RUN  v2.1.8 /home/user/project

 ✓ lib/auth/__tests__/login.test.ts (3 tests) 45ms
   ✓ validatePassword > returns true for correct password
   ✓ validatePassword > returns false for incorrect password
   ✓ validatePassword > throws on empty input
 ✓ lib/auth/__tests__/session.test.ts (4 tests) 23ms
   ✓ createSession > creates valid session
   ✓ createSession > sets correct expiry
   ✓ revokeSession > removes session from store
   ✓ revokeSession > returns false for nonexistent session
 ✗ lib/bouts/__tests__/scoring.test.ts (3 tests) 67ms
   ✓ calculateScore > sums round scores
   ✓ calculateScore > applies handicap
   ✗ calculateScore > handles zero rounds
     Expected: 0
     Received: NaN
     at Object.<anonymous> (lib/bouts/__tests__/scoring.test.ts:34:5)
 ✓ lib/common/__tests__/utils.test.ts (5 tests) 12ms
   ✓ formatDate > formats ISO dates
   ✓ formatDate > handles null input
   ✓ slugify > converts spaces to hyphens
   ✓ slugify > removes special characters
   ✓ slugify > lowercases output

 Test Files  3 passed | 1 failed
 Tests  14 passed | 1 failed
 Duration  892ms
```

Redesign this as a structured tool result (JSON) that:
- Tells the model immediately whether tests passed or failed
- Shows only the failing test details (file, test name, expected, actual, line)
- Includes total counts but not individual passing test names
- Costs less than 25% of the tokens of the raw output

**Verification:** Your structured result should be under 15 lines and contain all the
information the model needs to fix the failing test.

---

## Key Takeaways

Before moving to Step 6, verify you can answer these questions without looking anything up:

1. What is L7 in the layer model, and why is it described as the model's "only empirical
   contact with reality"?
2. What did Anthropic find when building their SWE-bench agent about the relative
   importance of tool definitions vs the overall prompt?
3. What is poka-yoke, and how does the "absolute paths only" example demonstrate it in
   tool design?
4. Why should read-only tools and write tools be separated? Name the three properties that
   differ between them.
5. What happens to the context window when a tool returns a 500-line file? How does this
   affect the model's available reasoning capacity?
6. What does MCP standardise, and what does it NOT standardise?
7. Why is the quality gate described as a "tool" rather than a post-processing step?
8. Name three ways git serves as a read tool in agentic workflows (not just `add`,
   `commit`, `push`).
9. What is the "poka-yoke test" for a tool schema? (Hint: three most likely incorrect
   invocations.)
10. Why is the tool description more important in ACI than in traditional API documentation?

---

## Recommended Reading

- **Anthropic, "Building effective agents"** - Schluntz, E. & Zhang, B. (2024). Published
  December 19, 2024. https://www.anthropic.com/engineering/building-effective-agents.
  Appendix 2 covers ACI design and poka-yoke. This is the most authoritative published
  source on agent tool design.

- **Model Context Protocol documentation** - https://modelcontextprotocol.io. The
  specification, reference implementations, and server examples. Start with the
  Introduction and Architecture pages.

- **OpenAI function calling documentation** - OpenAI API docs, "Function calling" guide.
  JSON Schema-based tool definitions, structured output mode, best practices for
  parameter design.

- **Shingo, "Zero Quality Control: Source Inspection and the Poka-Yoke System"** (1986).
  The original source for poka-yoke. Manufacturing context, but the principles of
  error-proofing through interface design apply directly to tool schema design.

- **This project:** `docs/internal/layer-model.md` L7 section, `AGENTS.md` "The Gate"
  section, `CLAUDE.md` for tool-use conventions in a production agentic workflow.

---

## What to Read Next

**Step 6: Verification and Quality for Probabilistic Systems** - The quality gate from
Section 8 of this step becomes the central concept. Step 6 covers: why testing probabilistic
systems requires different strategies than testing deterministic ones, the Swiss Cheese
Model applied to agent verification, the oracle problem (what happens when the human is
wrong), and the five named test anti-patterns from the slopodar - right answer wrong work,
phantom tollbooth, mock castle, shadow validation, confessional test. Where this step
treats the gate as a tool, Step 6 treats verification as a discipline. The tool design
principles from this step compose directly: well-designed verification tools with
structured output, concise results, and poka-yoke constraints are what make the gate
operationally useful rather than ceremonially present.

