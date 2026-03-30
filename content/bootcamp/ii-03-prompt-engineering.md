+++
title = "Prompt Engineering as System Design"
date = "2026-03-10"
description = "System prompts as specifications. Structured output. Few-shot patterns. The AGENTS.md pattern."
tags = ["prompts", "system-design", "bootcamp"]
step = 3
tier = 1
estimate = "5-6 hours"
bootcamp = 2
+++

Step 3 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This Step Exists

Most people learn prompt engineering by copying examples and adjusting until the output
looks right. This produces prompts that work until they do not, with no diagnostic
framework for understanding why they broke. "Try rewording it" is not root cause analysis.

In enterprise contexts, prompts are versioned artifacts maintained by teams, deployed
through CI/CD, and subject to change control. Treating prompt engineering as system design
means applying engineering discipline: version control, testing, structured decomposition,
and measurable outcomes.

Step 1 gave you the mechanical understanding - what a prompt becomes (tokens in a context
window), how attention distributes across those tokens, and why position matters. This step
turns that understanding into engineering practice: system prompts as specifications,
structured output formats, grounding documents that persist across sessions, and recognising
when the problem is architectural rather than linguistic.

The field covers core prompt engineering well. This step references Anthropic's tutorial,
OpenAI's documentation, and community resources, and adds three things they do not cover:
the L8 agent role layer and its saturation threshold, the working set concept, and the
AGENTS.md pattern as durable grounding infrastructure. The `AGENTS.md` file in this
project's root (~450 lines) is a worked example students can read alongside this step.

> **FIELD MATURITY: ESTABLISHED** for core practices - system prompts, structured output
> formats, few-shot patterns, role prompting, chain-of-thought. Anthropic, OpenAI, and
> the research community have published extensively on these techniques. The novel
> contribution of this step is the operational framing: prompts as infrastructure that
> occupies a specific layer (L8) with measurable position effects and a saturation
> threshold.

The goal: build prompts the way you build configuration files - structured, testable,
version-controlled, and grounded in understanding of how the system processes them.

---

## Table of Contents

1. [System Prompts as Specifications](#1-system-prompts-as-specifications) (~40 min)
2. [Structured Output: XML, JSON, YAML, Markdown](#2-structured-output-xml-json-yaml-markdown) (~40 min)
3. [Few-Shot Patterns](#3-few-shot-patterns) (~30 min)
4. [Role Prompting: Functional Constraint vs Decoration](#4-role-prompting-functional-constraint-vs-decoration) (~35 min)
5. [Agent-Computer Interface Design](#5-agent-computer-interface-design) (~40 min)
6. [Chain-of-Thought and Extended Thinking](#6-chain-of-thought-and-extended-thinking) (~30 min)
7. [The AGENTS.md Pattern](#7-the-agentsmd-pattern) (~45 min)
8. [Anti-Pattern: Prompt Engineering as Substitute for System Design](#8-anti-pattern-prompt-engineering-as-substitute-for-system-design) (~25 min)
9. [Challenges](#9-challenges) (~60-90 min)
10. [Key Takeaways](#10-key-takeaways)
11. [Recommended Reading](#11-recommended-reading)
12. [What to Read Next](#12-what-to-read-next)

---

## 1. System Prompts as Specifications

*Estimated time: 40 minutes*

A system prompt is not a conversation starter. It is a specification. It defines the
identity, constraints, communication protocol, and behavioural boundaries of an agent
instance. When a model receives a system prompt, that text occupies the **primacy position**
in the context window - the first tokens the model processes, which receive the strongest
attention weight due to primacy bias (Step 1, Section 5).

This makes system prompts structurally privileged. They are not just "instructions that come
first." They occupy the highest-attention real estate in the entire context window. Every
subsequent token - user messages, tool results, conversation history - is processed in the
context of the system prompt. The system prompt shapes the probability distribution for
everything that follows.

### Anatomy of a System Prompt

A well-structured system prompt has distinct sections, each serving a specific function:

```
1. Identity     - Who the agent is, what it does
2. Constraints  - What the agent must not do, hard boundaries
3. Protocol     - Communication format, output structure, response style
4. Context      - Domain knowledge, vocabulary, conventions
5. Examples     - (Optional) Concrete demonstrations of desired behaviour
```

This is not a suggestion. It is a structural pattern that maps to how the model processes
the information. Identity tokens at position 0 set the frame for everything else.
Constraints placed early benefit from primacy attention. Protocol instructions tell the
model what format its output should take before it begins generating. Context provides the
domain grounding. Examples anchor the pattern.

### The Two Failure Modes

**Underspecification.** "You are a helpful coding assistant" specifies almost nothing. The
model falls back to RLHF defaults - verbose, agreeable, eager to please. Behaviour is
inconsistent across users and sessions.

**Overspecification.** A system prompt that anticipates every scenario can exceed the L8
saturation threshold. arXiv:2602.11988 (Gloaguen et al., 2026) found that context files
following standard agent-developer recommendations "tend to reduce task success rates
compared to providing no repository context, while also increasing inference cost by over
20%." More instructions can make the agent worse, not better.

The engineering challenge: enough specification to constrain behaviour reliably, not so
much that attention is diluted across irrelevant instructions.

### Practical System Prompt Design

Here is a system prompt that specifies a code review agent. Read each section for its
function:

```
You are a code reviewer for a TypeScript/Next.js codebase.

CONSTRAINTS:
- Report findings in YAML format only. No prose before or after the YAML block.
- Rate severity 1-5 (1=style, 2=minor, 3=moderate, 4=serious, 5=critical).
- Do not suggest rewrites. Report the finding and location only.
- If no findings, return an empty YAML array: []

PROTOCOL:
- One YAML document per review.
- Each finding has: file, line, severity, category, description.
- Categories: security, correctness, performance, style, maintainability.

CONVENTIONS:
- This project uses 2-space indentation, Drizzle ORM, Neon Postgres.
- printf, not echo, in all bash contexts.
- No em-dashes in any output.
```

This is 20 lines. Every line constrains or enables a specific behaviour. Compare to:

```
You are a helpful and experienced code reviewer. You have deep expertise in
TypeScript and modern web frameworks. When reviewing code, please think carefully
about potential issues and provide constructive feedback that helps developers
improve their skills. Try to be thorough but also kind and encouraging.
```

This specifies almost nothing. "Helpful and experienced" is decoration. "Think carefully" is
not a constraint. The output format is unspecified, so parsing is impossible.

### Version Control and Testing

System prompts belong in version control. They are configuration files with the same
lifecycle as any other configuration. Changes go through pull requests. Testing means
sending a standard set of inputs through the prompt and comparing outputs against expected
behaviour. This is not exotic. It is what you already do with configuration files.

> **AGENTIC GROUNDING:** When an agent produces wrong or inconsistent output across
> sessions, check the system prompt first. A system prompt that says "be helpful" gives
> the model no actionable constraint. A system prompt that says "respond in YAML with
> fields: file, line, severity, finding" gives the model a deterministic output format
> you can parse and verify. The fix for inconsistent agent behaviour is almost always a
> more precise specification, not a longer one. System prompts are L8 content occupying
> the primacy position - make every token count.

---

## 2. Structured Output: XML, JSON, YAML, Markdown

*Estimated time: 40 minutes*

When an agent's output is consumed by another program, the format matters as much as the
content. Structured output turns an LLM from a text generator into a data pipeline
component. Each format has distinct properties. The choice is not arbitrary.

**XML: Natural for LLMs, robust for nesting.**

LLMs have seen enormous quantities of XML and HTML in their training data. XML tags are
well-represented in the tokeniser vocabulary. Models generate well-formed XML more reliably
than some other formats because the token sequences are deeply embedded in L0 weights.

```xml
<review>
  <finding>
    <file>lib/auth/login.ts</file>
    <line>47</line>
    <severity>4</severity>
    <category>security</category>
    <description>Password compared with === instead of timing-safe comparison</description>
  </finding>
  <finding>
    <file>lib/auth/login.ts</file>
    <line>52</line>
    <severity>2</severity>
    <category>style</category>
    <description>Magic number 3 should be a named constant for max retry attempts</description>
  </finding>
</review>
```

Advantages: no escaping issues for most content, natural nesting, Anthropic recommends XML
for structuring prompts. Disadvantage: verbose, not a standard API response format.

**JSON: Standard for machine consumption, strict syntax.**

JSON is the lingua franca of web APIs. Parsers exist in every language. Schema validation
(JSON Schema) is mature. OpenAI's Structured Outputs mode can constrain the model to
generate schema-valid JSON, eliminating parse failures entirely.

```json
{
  "findings": [
    {
      "file": "lib/auth/login.ts",
      "line": 47,
      "severity": 4,
      "category": "security",
      "description": "Password compared with === instead of timing-safe comparison"
    },
    {
      "file": "lib/auth/login.ts",
      "line": 52,
      "severity": 2,
      "category": "style",
      "description": "Magic number 3 should be named constant for max retry attempts"
    }
  ]
}
```

Advantages: universal parsing, schema validation, compact. Disadvantage: escaping overhead.
Newlines must be `\n`, quotes must be `\"`. Code snippets inside JSON strings are a
minefield. One missing comma breaks the entire output.

**YAML: Human-readable, good for configuration.**

YAML is the format this project uses for structured data (per standing policy SD-258).
It is the most readable of the three formats and handles multi-line strings naturally.

```yaml
findings:
  - file: lib/auth/login.ts
    line: 47
    severity: 4
    category: security
    description: Password compared with === instead of timing-safe comparison
  - file: lib/auth/login.ts
    line: 52
    severity: 2
    category: style
    description: Magic number 3 should be named constant for max retry attempts
```

Advantages: human-readable, multi-line strings handled cleanly, compact. Disadvantage:
indentation-sensitive - a model indentation error corrupts the structure. Less robust
schema validation than JSON.

**Markdown: Default for prose-heavy output.**

Markdown is the natural LLM output format - it dominates training data. For human-facing
output where structure is needed but full parsing is not, Markdown is appropriate.

```markdown
## Review: lib/auth/login.ts

### Finding 1 (Severity 4 - Security)
**Line 47:** Password compared with === instead of timing-safe comparison

### Finding 2 (Severity 2 - Style)
**Line 52:** Magic number 3 should be named constant for max retry attempts
```

Advantages: natural for models, readable, renderable. Disadvantage: not machine-parseable
without fragile regex. Structure is semantic, not syntactic.

### When to Use Each Format

| Use Case | Recommended Format | Rationale |
|----------|-------------------|-----------|
| API response consumed by code | JSON | Universal parsing, schema validation |
| Input structuring within prompts | XML | Anthropic-recommended, no escaping |
| Configuration and human-readable data | YAML | Readable, multi-line support |
| Human-facing reports and documentation | Markdown | Natural default, renderable |
| Data exchange between agents | JSON or YAML | Parseable, schema-describable |
| Complex nested structures | XML or JSON | Both handle arbitrary nesting |
| Embedding code snippets in output | XML or YAML | No JSON escaping required |

### Forcing Format Compliance

The prompt determines whether the model respects the format. A weak format instruction:

```
Please return your answer as JSON.
```

A strong format instruction:

```
Return ONLY a JSON object with this exact schema. No text before or after the JSON.
{
  "findings": [
    {
      "file": "string",
      "line": "integer",
      "severity": "integer 1-5",
      "category": "one of: security, correctness, performance, style",
      "description": "string, one sentence"
    }
  ]
}
```

The strong version gives the model a concrete schema. "No text before or after" prevents
the model from wrapping valid JSON in commentary (a common failure mode that breaks
parsers).

For production systems, use provider-specific enforcement. OpenAI's Structured Outputs mode
constrains generation to schema-valid JSON. Anthropic's tool use mechanism returns
structured data within a defined schema. Both move compliance from "the model should" to
"the system enforces."

> **HISTORY:** XML was the dominant data interchange format on the web from the late 1990s
> through the mid-2000s (SOAP, XSLT, RSS, XHTML). JSON replaced it for most API use cases
> after Douglas Crockford formalised the specification around 2001, with adoption
> accelerating after the rise of REST APIs and AJAX. The consequence for LLMs: models
> trained on web data have seen vastly more XML and HTML than JSON in absolute terms
> (decades of XML-era web pages), which may explain why they handle XML tags more reliably
> than strict JSON syntax. YAML emerged from the early 2000s as a human-friendly
> serialisation format and became the standard for configuration files (Kubernetes, Docker
> Compose, CI/CD pipelines, Ansible).

> **AGENTIC GROUNDING:** When an agent's output needs to be parsed by another system, use
> JSON with a schema or XML with defined tags. When the output is for human review, use
> Markdown or YAML. When the output might contain code snippets, avoid JSON (escaping
> issues) and use XML or YAML instead. The format choice is not aesthetic - it determines
> whether your parsing pipeline breaks on edge cases. An agent that produces beautiful
> prose with an embedded JSON block that has an unescaped newline in a string field will
> break every JSON parser downstream. Design the format before you design the prompt.

---

## 3. Few-Shot Patterns

*Estimated time: 30 minutes*

Few-shot prompting is the technique of providing examples of desired input-output pairs
within the prompt. The model uses these examples to infer the pattern and apply it to new
inputs. It is one of the most effective prompting techniques - and one of the most
misused.

### How Few-Shot Works Mechanically

At L2 (attention), the model attends to all tokens in context. When examples are present,
attention heads match structural patterns between examples and the current input. This is
not "learning" (L0 is frozen). It is pattern matching at L2/L3 - examples occupy context
positions that influence generation through L0 statistical associations.

### The Three Types of Few-Shot

**Zero-shot:** No examples. The model relies entirely on the instruction and its L0 weights.

```
Classify the following support ticket as one of: billing, technical, account, other.

Ticket: "I can't log into my account after changing my password yesterday."
```

**One-shot:** One example.

```
Classify the following support ticket as one of: billing, technical, account, other.

Example:
Ticket: "My credit card was charged twice for the same month."
Classification: billing

Now classify:
Ticket: "I can't log into my account after changing my password yesterday."
```

**Few-shot (2-5 examples):**

```
Classify the following support ticket as one of: billing, technical, account, other.

Example 1:
Ticket: "My credit card was charged twice for the same month."
Classification: billing

Example 2:
Ticket: "The dashboard keeps showing a 500 error when I click on reports."
Classification: technical

Example 3:
Ticket: "I need to change the email address on my account."
Classification: account

Now classify:
Ticket: "I can't log into my account after changing my password yesterday."
```

### The Diminishing Returns Curve

More examples is not monotonically better. Research and practice consistently show a
pattern:

| Examples | Typical Effect |
|----------|---------------|
| 0 (zero-shot) | Works for simple, well-defined tasks. Fails on ambiguous or novel patterns. |
| 1 | Large jump in accuracy for format and pattern adherence. |
| 2-3 | Moderate improvement, especially for edge case coverage. |
| 4-5 | Diminishing returns. Each additional example provides less marginal improvement. |
| 6+ | Risk of overfitting to examples. Token budget consumed. Negligible further improvement. |

The practical rule: **start with zero-shot. If the output format or pattern is wrong, add
one example. If edge cases are mishandled, add 2-3 examples that demonstrate the edge
cases specifically. Rarely go above 5.**

Each example consumes context window budget. Five examples of a complex task might cost
500-2,000 tokens - budget that could otherwise be used for tool results, conversation
history, or retrieved documents. Few-shot is a budget allocation decision.

### Selecting Good Examples

The examples you choose determine the pattern the model infers. Three principles:

**Cover the boundaries, not the centre.** If classifying sentiment as positive/negative/
neutral, provide one of each plus one genuinely ambiguous case. The model needs to see how
you handle hard cases, not obvious ones.

**Include the edge case you care about.** If you need the model to output "unknown" when
the input is insufficient, include an example where the correct output is "unknown." If
that case never appears in the examples, the model will force-classify into a category it
has seen.

**Match the target distribution loosely.** Over-representing rare categories helps the
model recognise them, but severely over-representing them causes over-classification.
Balance recognition of rare cases against realistic priors.

### Overfitting to Examples

The most common few-shot failure mode: the model copies surface features of the examples
rather than learning the underlying pattern. If all examples have short descriptions, the
model produces short descriptions even when the input warrants a longer one. If all
examples start with "The", outputs start with "The."

The defence is example diversity. Vary surface features (length, phrasing, structure) while
keeping the pattern consistent.

> **AGENTIC GROUNDING:** In agentic workflows, few-shot examples compete with tool results
> and conversation history for context window budget. If your agent reads 5 source files
> (15,000 tokens) and has 5 few-shot examples (1,500 tokens), the examples are consuming
> 10% of the available context for a technique that may provide marginal improvement over
> a clear zero-shot instruction. The ROI calculation matters. Use few-shot when the task
> has a specific output format that the model gets wrong without examples. Use zero-shot
> when a clear instruction suffices. Never use few-shot as a substitute for a clear
> specification.

---

## 4. Role Prompting: Functional Constraint vs Decoration

*Estimated time: 35 minutes*

"You are a helpful assistant" is the most common role prompt in LLM applications. It is
also nearly useless. The model was already trained to be a helpful assistant through RLHF
(Step 1, Section 8). Telling it to be helpful is like telling a calculator to do math.

Role prompting works when it provides **functional constraints** - information that changes
what the model generates, not just how it feels about generating it. The distinction
between functional and decorative role prompts is one of the highest-leverage concepts in
prompt engineering.

### Decorative Roles (Waste of Tokens)

These role prompts consume tokens without changing model behaviour in measurable ways:

```
You are a helpful and knowledgeable assistant.
You are an experienced software developer.
You are a world-class expert in Python.
You are a friendly and professional customer support agent.
```

None of these constrain behaviour. "Experienced software developer" does not specify
language, conventions, output format, or ambiguity handling. The model interprets these as
reinforcement of its RLHF defaults. You are paying tokens for no behavioural change.

### Functional Roles (Constrain Behaviour)

These role prompts change what the model generates:

```
You are a code reviewer who reports findings in YAML format, one finding per entry,
severity rated 1-5. You do not suggest fixes. You do not explain why something is a
problem. You report the file, line number, severity, and a one-sentence description.
```

```
You are a SQL query generator for PostgreSQL 15. You output ONLY valid SQL. No
explanations, no markdown formatting, no comments. If the request is ambiguous, output
nothing and set the error field to describe the ambiguity.
```

```
You are a technical writer who produces API documentation in OpenAPI 3.0 YAML format.
Every endpoint includes: path, method, summary, request body schema, response schemas
for 200 and 4xx codes, and one curl example.
```

Each specifies output format, scope boundaries, ambiguity handling, and concrete
deliverables. The difference from default behaviour is measurable.

### The Functional Test

To determine whether a role prompt is functional or decorative, apply this test:

**Remove the role prompt and run the same input. Does the output change in a measurable,
structural way?**

If removing "You are a helpful assistant" produces the same output, the role prompt was
decoration. If removing "You report findings in YAML format, severity rated 1-5" changes
the output from YAML to prose, the role prompt was functional.

This test is not theoretical. Run it. Send the same input with and without the role prompt.
Diff the outputs. If they are structurally identical, delete the role prompt and reclaim
the tokens.

### Role Prompting as L8 Content

In the layer model, role prompting occupies L8 (agent role) at high-attention primacy
positions. This structural privilege gives L8 content disproportionate influence on
generation - but the influence is not unlimited.

Role fidelity degrades over long contexts. An agent processing its 50th tool call may
have drifted from its role prompt because accumulated L9 context (thread position) has
diluted the L8 signal. The system prompt is at position 0, but attention spread across
100,000+ tokens means less weight per position. This is the practical consequence of the
L8 saturation threshold: "More role content is not monotonically better."

> **HISTORY:** Role prompting has roots in the concept of "priming" from cognitive
> psychology (Meyer & Schvaneveldt, 1971) - the observation that prior context influences
> subsequent processing. In LLM applications, Simon Willison and others in the prompt
> engineering community documented the effectiveness of role prompts starting around 2022,
> as GPT-3 and ChatGPT demonstrated that "You are a pirate" actually changed linguistic
> output. The distinction between decorative and functional roles emerged from engineering
> practice rather than research - engineers observed that some role prompts changed
> behaviour and others did not, and worked backward to understand why. Anthropic's prompt
> engineering documentation formalises this by recommending role prompts that include
> "specific task instructions" rather than personality descriptions.

> **AGENTIC GROUNDING:** When designing an agent's role prompt, every sentence should pass
> the functional test: does removing it change the output? If an agent is producing output
> that does not match expectations, check whether the role prompt specifies the output
> format and constraints concretely, or whether it describes a persona and hopes for the
> best. "You are an experienced DevOps engineer" tells the model nothing actionable. "You
> generate Terraform HCL files for AWS. You output ONLY valid HCL. You include resource
> tags for cost-center, environment, and owner on every resource" tells the model exactly
> what to produce.

---

## 5. Agent-Computer Interface Design

*Estimated time: 40 minutes*

> **FIELD MATURITY: EMERGING.** Agent-Computer Interface (ACI) design was introduced by
> Anthropic in their "Building effective agents" article (December 2024) and is not yet
> widely adopted as a formal discipline. The insight - that tool definitions deserve as
> much engineering as prompts - represents a significant shift from the common practice of
> defining tools quickly and focusing engineering effort on the prompt.

When an agent uses tools, the tool definitions are part of the prompt. They occupy context
window space and are processed by the same attention mechanism. The model's ability to use
a tool correctly depends as much on the definition quality as on the system prompt quality.

Anthropic's finding: "While building our agent for SWE-bench, we actually spent more time
optimizing our tools than the overall prompt." Tool definitions are a leverage point, not
boilerplate.

### ACI as Poka-Yoke

**Poka-yoke** (Shingo, 1986) means "error-proofing" - designing interfaces so that
mistakes are structurally impossible. A USB-C connector that only fits one way is
poka-yoke.

Anthropic's concrete example: their SWE-bench agent made mistakes with relative file paths
after changing directories. The fix was not better prompting. The fix was requiring
absolute file paths in the tool definition - making the error structurally impossible.
Result: flawless tool use.

Instead of instructing the model to "be careful with file paths," change the interface so
that only absolute paths are accepted. Instead of "always include the required fields,"
make them non-optional in the schema.

### Tool Definition Quality

Poor tool definitions produce poor tool use, the same way poor variable names produce
poor code.

**Poor tool definition:**

```json
{
  "name": "search",
  "description": "Search for stuff",
  "parameters": {
    "q": {
      "type": "string",
      "description": "query"
    },
    "n": {
      "type": "integer",
      "description": "number"
    }
  }
}
```

**Good tool definition:**

```json
{
  "name": "search_codebase",
  "description": "Search the project codebase for files matching a pattern or containing specific text. Returns file paths and line numbers. Use this when you need to find where something is defined, imported, or used.",
  "parameters": {
    "query": {
      "type": "string",
      "description": "The search pattern. For text search, use a regex pattern. For file search, use a glob pattern like '**/*.ts'. Be specific - broad patterns return too many results."
    },
    "max_results": {
      "type": "integer",
      "description": "Maximum number of results to return. Default 10. Use higher values (up to 50) only when you need comprehensive coverage. Each result consumes context window tokens.",
      "default": 10
    },
    "search_type": {
      "type": "string",
      "enum": ["text", "file", "symbol"],
      "description": "The type of search. 'text' searches file contents. 'file' matches file paths. 'symbol' searches for function/class/variable definitions."
    }
  },
  "required": ["query", "search_type"]
}
```

The differences:

1. **Descriptive tool name.** `search_codebase` not `search`. The model knows the domain.
2. **Usage guidance in description.** "Use this when..." helps the model select the right tool.
3. **Full-word parameter names.** `query` not `q`. `max_results` not `n`. The model attends to names.
4. **Guidance in parameter descriptions.** "Be specific" constrains query construction.
5. **Enum constraints.** `search_type` with an enum makes invalid values impossible. Poka-yoke.

### Writing Tool Definitions Like Docstrings

Anthropic's guidance: write tool descriptions like docstrings for a junior developer. The
test: show the definition to a colleague. Can they use the tool correctly without reading
the implementation? If not, the definition needs work.

### The Documentation-as-Interface Principle

Tool definitions are not API documentation that lives alongside the implementation. They
are the interface itself. The model does not read your README or browse source code. It
reads the tool definition in the context window and generates calls based on that
definition. If the definition is wrong, the tool calls are wrong.

This inverts the normal priority. In human development, implementation is primary and
documentation is secondary. In ACI design, the definition is primary because it is the
only thing the model sees.

> **AGENTIC GROUNDING:** Tool definition quality is a direct lever on agent reliability.
> If an agent misuses a tool - wrong parameters, wrong tool selection, wrong interpretation
> of results - check the tool definition before blaming the model. Anthropic spent more time
> on tool definitions than on the overall prompt for their SWE-bench agent, and the
> highest-impact fix was a poka-yoke constraint (absolute paths only). This pattern
> generalises: when a model makes systematic errors with a tool, the fix is usually in
> the tool definition, not in the prompt. Make the wrong thing hard. Make the right thing
> obvious.

---

## 6. Chain-of-Thought and Extended Thinking

*Estimated time: 30 minutes*

Chain-of-thought (CoT) prompting asks the model to reason before answering. Extended
thinking (Claude) and reasoning models (OpenAI o1/o3, GPT-5) take this further by
generating internal reasoning tokens before the visible response. Both address the
autoregressive constraint (Step 1, Section 6): giving the model space to "think first"
improves subsequent generation quality.

### Chain-of-Thought Prompting

CoT is a prompting technique. You request it explicitly:

```
Before answering, think through the problem step by step.
Show your reasoning in <thinking> tags, then provide your answer in <answer> tags.
```

The model generates reasoning tokens that are visible in the output. You pay for them, you
see them, and they become part of the context for subsequent generation. The reasoning
process is fully transparent.

### Extended Thinking

Extended thinking is a model capability. You enable it through the API:

```python
response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=16000,
  thinking={
    "type": "enabled",
    "budget_tokens": 10000
  },
  messages=[{"role": "user", "content": "Analyze this code for security issues..."}]
)
```

The model generates reasoning tokens before the visible response. The budget controls how
many tokens the model spends on reasoning. More budget allows deeper analysis but costs
more and takes longer.

### When Reasoning Helps and When It Hurts

| Task Type | Reasoning Benefit | Cost/Latency Increase | Recommendation |
|-----------|------------------|----------------------|----------------|
| Complex debugging | High | Worth it | Enable |
| Architecture planning | High | Worth it | Enable |
| Multi-step logic problems | High | Worth it | Enable |
| Simple code generation | Low | Not worth it | Disable |
| Classification / routing | Low | Not worth it | Disable |
| Text formatting | None | Wasted | Disable |
| Factual retrieval | Low | Not worth it | Disable |

The pattern: reasoning helps when the problem requires considering multiple possibilities
or working through sequential logic. It wastes tokens on straightforward generation or
retrieval.

OpenAI's guidance: "A reasoning model is like a senior co-worker. Give them a goal. A GPT
model is like a junior coworker. Give them explicit instructions." With reasoning models,
specify goals. With non-reasoning models, specify steps.

### The Budget Trade-off

Reasoning tokens are real tokens. A model that "thinks for 5,000 tokens" before generating
200 tokens has consumed 5,200 output tokens. For agentic systems making dozens of API
calls, the reasoning budget has a multiplicative effect on cost. Enable for planning and
complex analysis. Disable for routine calls.

> **AGENTIC GROUNDING:** Extended thinking is your best diagnostic window into the model's
> decision process. When an agent makes a surprising decision, check the reasoning tokens
> (if available). If the reasoning says "I should validate the input first" but the
> generated code does not validate input, you have identified a specific generation failure
> at L4 - the model knew what to do but failed to execute it. This is more diagnostic than
> looking at the output alone. For production agent systems, enable extended thinking for
> planning and decision-making calls, and disable it for routine execution calls. The
> cost difference is substantial and the quality difference for routine tasks is minimal.

---

## 7. The AGENTS.md Pattern

*Estimated time: 45 minutes*

> **FIELD MATURITY: EMERGING.** The practice of grounding documents that persist across
> agent sessions is emerging rapidly (2025-2026) but lacks standardised practice.
> arXiv:2602.11988 (Gloaguen et al., 2026) provides the first empirical evaluation,
> finding that repository-level context files can reduce task success when they contain
> unnecessary content - directly supporting the working set concept.

A system prompt defines behaviour for a single session. Agents working on a codebase need
persistent context: conventions, architectural boundaries, vocabulary, standing policies.
This context does not belong in the system prompt (too long, changes with the project) or
the conversation (lost at session end). It belongs on disk.

The AGENTS.md pattern solves **durable grounding** - giving an agent the context it needs
without re-specifying everything each session.

### What Belongs Where

The three-tier model for agent context placement:

| Layer | What Goes Here | Lifecycle | Token Budget |
|-------|---------------|-----------|-------------|
| System prompt | Identity, hard constraints, communication protocol | Per-session, set by harness | 500-2,000 tokens |
| Conversation | Current task, user instructions, tool results | Per-interaction, accumulates | Growing, bounded by L3 |
| Disk (AGENTS.md) | Standing policy, vocabulary, conventions, architecture | Per-project, version-controlled | Loaded on demand |

Standing policies (rules applying across all sessions) belong on disk. Task-specific
instructions (what to do right now) belong in the conversation. Identity and protocol
belong in the system prompt.

### The Working Set Concept

Not all context on disk needs to be loaded. The **working set** is the minimum context
for the current job. If the working set is present in the context window, the agent produces
correct output. If it is absent, the agent cannot.

The concept is from operating systems theory. Peter Denning (1968) defined the working set
as the minimum pages in RAM for efficient operation. The isomorphism is exact: minimum
pages in RAM = minimum tokens in context for correct generation.

Load what the agent needs, not everything the project has. An agent fixing a bug in
`lib/auth/login.ts` needs authentication docs, not billing docs. arXiv:2602.11988
confirms: context files with unnecessary requirements make tasks harder. The model follows
extra instructions even when irrelevant, consuming tokens and reducing focus.

### The AGENTS.md File in This Project

The `AGENTS.md` file in the root of this repository is a worked example. Open it and read
it alongside this section. As of this writing, it is approximately 450 lines and contains:

| Section | Lines | Purpose |
|---------|-------|---------|
| True North | 3 | Primary objective. Every decision measured against this. |
| Standing Orders | 25 | Policies that persist across sessions. Not suggestions - constraints. |
| The Gate | 3 | Quality gate commands. Shortest and most important section. |
| Engineering Loop | 3 | Read -> Verify -> Write -> Execute -> Confirm. |
| HCI Foot Guns | 20 | Named failure modes with definitions, fixes, layer refs. |
| Lexicon | 100 | Compressed vocabulary. O(1) communication via named concepts. |
| Layer Model | 30 | 13-layer diagnostic framework for localising failures. |
| Filesystem Map | 20 | BFS depth map. What exists where. |
| Conventions | 10 | Technical stack, formatting, tooling. |

### Design Principles for AGENTS.md Files

Building on arXiv:2602.11988 and this project's operational experience:

1. **Minimal requirements only.** Every line should constrain or enable a specific
   behaviour. If removing a line does not change agent behaviour, remove it.

2. **Structured for scanning, not reading.** Tables, bullet points, and short sections
   scan better than prose. The model attends to a table row more precisely than to a
   phrase buried in a paragraph.

3. **Standing policy, not tutorial.** Do not explain why conventions exist. State what
   they are. "2 spaces indentation" not "We use 2 spaces because..."

4. **Version-controlled.** AGENTS.md is a code artifact in git. If the conventions change,
   the file changes. A stale AGENTS.md is a lying AGENTS.md.

5. **BFS depth control.** Domain-specific documentation goes in domain files
   (`lib/auth/DOMAIN.md`), not AGENTS.md. Keep AGENTS.md at depth-1 (always loaded).
   This prevents the bloat that arXiv:2602.11988 warns against.

### The Saturation Threshold

"More role content is not monotonically better." There is a threshold beyond which
additional grounding degrades performance. Stale entries consume attention without signal.
Excessive instructions compete, and the model resolves conflicts by pattern-matching rather
than reasoning about priorities.

The threshold varies by model and task. But the direction is clear: 5,000 tokens of
focused grounding outperforms 20,000 tokens of comprehensive-but-irrelevant grounding.
Load what the agent needs, not everything the project has.

> **AGENTIC GROUNDING:** This project's `AGENTS.md` file is designed as a boot sequence.
> When an agent loads it, the agent gets: primary objective, standing policies, quality
> gate, engineering loop, named failure modes, vocabulary, layer model, filesystem map, and
> conventions. That is approximately 450 lines - enough to ground the agent in the project's
> operational context without exceeding the saturation threshold. If you are building your
> own AGENTS.md, start with the three shortest sections (True North, Gate, Engineering
> Loop) and add only what is necessary for the agent to operate correctly on your project.
> Resist the urge to document everything. Document the minimum. "Human-written context
> files should describe only minimal requirements" (arXiv:2602.11988).

---

## 8. Anti-Pattern: Prompt Engineering as Substitute for System Design

*Estimated time: 25 minutes*

A prompt that grows longer as edge cases are addressed one by one, each with another
paragraph of instructions. The root cause: the problem is not linguistic. It is structural.

### Recognising the Anti-Pattern

**Signal 1: The prompt keeps growing.** If you have added instructions to the prompt three
times to address three different failures, and the failures are in different categories (output
format, error handling, scope boundaries), the prompt is not the problem. The system design
is the problem. You need structured output enforcement, error handling at the harness layer
(L6), and task decomposition (Step 2) - not more words.

**Signal 2: Instructions contradict each other.** "Be thorough but concise." "Cover all
edge cases but keep the response short." Together, they force the model to resolve
contradictions through L0 pattern-matching. The fix: separate "thorough analysis" from
"concise summary" into two agent calls.

**Signal 3: You are prompting around a tool limitation.** Three paragraphs about file
path conventions in the system prompt? Wrong layer. Fix the tool definition: require
absolute paths, validate before execution. This is poka-yoke from Section 5.

**Signal 4: Success depends on exact wording.** If changing "please" to "you must"
significantly changes output quality, the system is fragile. Robust systems do not depend
on linguistic subtlety.

### Where the Fix Actually Lives

| Symptom | Wrong Fix (Prompt) | Right Fix (Architecture) |
|---------|-------------------|-------------------------|
| Output format inconsistent | "Always output JSON" | Structured Outputs mode / tool return schema |
| Agent ignores context from early in conversation | "Remember to consider all context" | Context window management, summarisation |
| Agent makes errors on complex tasks | "Think carefully about each step" | Task decomposition (Step 2 patterns) |
| Agent drifts from instructions over long sessions | "Refer back to the system prompt" | Fresh context per subtask (one-shot agent job) |
| Agent misuses tools | "Be careful with file paths" | Poka-yoke in tool definitions |
| Agent produces inconsistent quality | "Maintain high quality" | Quality gate verification |

The pattern: if the fix is "tell the model to do X," ask whether the system can enforce X
instead. Enforcement at the harness layer is deterministic. Instruction at the prompt layer
is probabilistic.

### Prompt Engineering IS Necessary

This is an anti-pattern warning, not a dismissal. Prompt engineering handles specification -
telling the model what to do. It does not handle enforcement - ensuring the model did it
correctly. The verification pipeline (Step 6), the quality gate, and the architectural
patterns (Step 2) handle enforcement. A complete system needs both.

The mature stance: design the prompt for specification, design the system for enforcement,
and know which problems belong to which layer.

> **AGENTIC GROUNDING:** When you find yourself editing a prompt for the third time to fix
> a different class of failure, stop. Ask: "Is this a specification problem or an
> enforcement problem?" If the model does not know what format to use, fix the prompt. If
> the model knows what format to use but sometimes gets it wrong, fix the system - add
> schema validation, output parsing, or retry logic. The most common agentic engineering
> mistake is treating every failure as a prompt failure. Some failures are L8 (prompt).
> Some are L6 (harness). Some are L7 (tools). Some are L3 (context). Diagnosing the right
> layer is more valuable than perfecting the wrong one.

---

## Challenge: System Prompt Comparison

**Estimated time: 15 minutes**

**Goal:** Write two system prompts for the same task and measure the behavioural difference.

```python
#!/usr/bin/env python3
"""Compare decorative vs functional system prompts."""

import anthropic

client = anthropic.Anthropic()

code_to_review = """
def process_payment(user_id, amount, currency="USD"):
    db = get_database()
    user = db.query("SELECT * FROM users WHERE id = " + str(user_id))
    if user:
        balance = user.balance - amount
        db.execute(f"UPDATE users SET balance = {balance} WHERE id = {user_id}")
        log("Payment processed for " + str(amount))
        return True
    return False
"""

prompt_a = "You are a helpful and experienced code reviewer. You have deep " \
  "expertise in Python and security best practices. Please review the code " \
  "thoroughly and provide constructive, detailed feedback."

prompt_b = """You are a code reviewer. Report findings in YAML format only.
No prose before or after the YAML.

Schema per finding:
  line: integer
  severity: 1-5 (1=style, 5=critical)
  category: one of [security, correctness, performance, style]
  finding: one sentence

If no findings, output: []"""

for label, prompt in [("Decorative", prompt_a), ("Functional", prompt_b)]:
  response = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024,
    system=prompt,
    messages=[{"role": "user", "content": f"Review this code:\n{code_to_review}"}]
  )
  print(f"\n=== {label} === ({response.usage.output_tokens} tokens)")
  print(response.content[0].text[:600])
```

**Verification:**
- Version A should produce free-form prose. Different runs may produce different formats.
- Version B should produce parseable YAML with consistent structure.
- Compare: output token count (A should be higher), parseability (B should parse as YAML),
  consistency across 3 runs (B should be more consistent).

**What you are learning:** Functional constraints produce measurably different output.
Decorative role prompts produce output indistinguishable from the model's RLHF default.

---

## Challenge: Structured Output Parsing

**Estimated time: 20 minutes**

**Goal:** Get an LLM to produce valid, parseable structured output and handle parse failures.

```python
#!/usr/bin/env python3
"""Structured output generation and parsing."""

import anthropic
import json

client = anthropic.Anthropic()

schema_prompt = """Analyze the following code and return a JSON object with this exact
schema. Return ONLY the JSON object. No markdown fences, no explanation.

{
  "functions": [{"name": "string", "parameters": ["string"],
    "return_type": "string or null", "complexity": "low | medium | high",
    "issues": ["string"]}],
  "overall_quality": "integer 1-10",
  "primary_concern": "string, one sentence"
}"""

code_sample = """
import os, subprocess

def deploy(env, version, force=False):
    if env not in ["staging", "production"]:
        raise ValueError(f"Unknown environment: {env}")
    cmd = f"kubectl set image deployment/app app={version}"
    if env == "production" and not force:
        approval = input("Production deploy. Continue? (y/n): ")
        if approval != "y":
            return False
    result = subprocess.run(cmd, shell=True, capture_output=True)
    if result.returncode != 0:
        return False
    os.system(f"echo 'Deployed {version} to {env}' >> /var/log/deploys.log")
    return True
"""

response = client.messages.create(
  model="claude-sonnet-4-20250514", max_tokens=1024,
  system=schema_prompt,
  messages=[{"role": "user", "content": code_sample}]
)

raw = response.content[0].text

# Strip markdown fences if added despite instructions
cleaned = raw.strip()
if cleaned.startswith("```"):
  cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]

try:
  parsed = json.loads(cleaned)
  print(f"Parse SUCCESS - {len(parsed.get('functions', []))} functions found")
  print(f"Quality: {parsed.get('overall_quality')}")
  print(f"Concern: {parsed.get('primary_concern')}")
  for func in parsed.get("functions", []):
    assert func["complexity"] in ["low", "medium", "high"]
  print("Schema validation PASSED")
except json.JSONDecodeError as e:
  print(f"Parse FAILED: {e}\nRaw:\n{raw[:300]}")
except (AssertionError, KeyError) as e:
  print(f"Schema validation FAILED: {e}")
```

**Verification:** Run 5 times. Note how many times the JSON parses successfully and how
many times the schema validates. If the success rate is below 100%, modify the prompt to
improve it. Document what change improved reliability.

**Extension:** Rewrite the prompt to request YAML instead of JSON. Compare parse success
rates. Does the model produce valid YAML more or less reliably than valid JSON?

---

## Challenge: ACI Design Exercise

**Estimated time: 20 minutes**

**Goal:** Design a tool definition that makes misuse difficult through poka-yoke principles.

Scenario: you are designing a file editing tool for a coding agent. The agent needs to be
able to modify files in a repository. Design the tool schema, parameter names, and
descriptions to minimise common errors.

Common errors to prevent:
- Relative file paths (agent changes directory, paths break)
- Editing a file without reading it first (blind edits)
- Replacing content that does not exist in the file (stale context)
- Creating new files when editing existing ones would suffice

Write two tool definitions:

```python
#!/usr/bin/env python3
"""ACI design exercise - compare naive vs poka-yoke tool definitions."""

import json

# Version A: Naive tool definition
naive_tool = {
  "name": "edit_file",
  "description": "Edit a file.",
  "parameters": {
    "path": {"type": "string", "description": "File path"},
    "content": {"type": "string", "description": "New content"},
    "mode": {"type": "string", "description": "write or append"}
  }
}

# Version B: Poka-yoke tool definition
# Design this yourself - then compare with the reference below
pokayoke_tool = {
  # YOUR DESIGN HERE
  # Consider:
  # - How to prevent relative path errors
  # - How to ensure the file was read before editing
  # - How to prevent replacing content that doesn't exist
  # - How to prevent accidental file creation
  # - What parameter names communicate intent most clearly
}

print("=== Naive Tool ===")
print(json.dumps(naive_tool, indent=2))

print("\n=== Your Poka-yoke Tool ===")
print(json.dumps(pokayoke_tool, indent=2))
```

<details>
<summary>Reference poka-yoke design</summary>

```json
{
  "name": "edit_file",
  "description": "Replace a specific text segment in an existing file. The file must have been read in this session before editing. This tool will FAIL if the old_content is not found in the file. Use this for modifying existing files only - use create_file for new files.",
  "parameters": {
    "absolute_path": {
      "type": "string",
      "description": "The absolute path to the file, starting with /. Relative paths are rejected. Example: /home/user/project/src/main.ts"
    },
    "old_content": {
      "type": "string",
      "description": "The exact text to find and replace. Must match the file content exactly, including whitespace and indentation. If this text is not found in the file, the edit fails with an error. Copy this from the file contents you read earlier."
    },
    "new_content": {
      "type": "string",
      "description": "The replacement text. Must be different from old_content. To delete text, use an empty string."
    }
  },
  "required": ["absolute_path", "old_content", "new_content"]
}
```

Key poka-yoke features:
- `absolute_path` not `path` - the name itself communicates the requirement
- `old_content` / `new_content` pattern prevents blind overwrites
- Description states the tool will FAIL on missing content - setting expectations
- Separate `create_file` tool for new files prevents accidental creation
- "Must have been read in this session" enforces read-before-write

</details>

**Verification:** For each design decision in your tool definition, state what error it
prevents. If a decision does not prevent a specific error, it may be unnecessary.

---

## Challenge: AGENTS.md Creation

**Estimated time: 30 minutes**

**Goal:** Write a grounding document for a project you work on (or a hypothetical project),
applying the working set principle and the design guidelines from Section 7.

Requirements:
- Maximum 200 lines (enforce the minimal requirements principle)
- Must include: project identity (3 lines), quality gate (5 lines), conventions (10 lines),
  filesystem map (15 lines)
- Must NOT include: tutorials, explanations of why conventions exist, or comprehensive
  documentation of all project features

Use this skeleton:

```markdown
# Project Grounding - [Your Project Name]

## True North
[One sentence: what is this project for?]

## Quality Gate
[The exact commands that must pass before any change is ready]

## Standing Orders
[Rules that apply across all sessions, stated as imperatives]

## Conventions
[Technical stack, formatting, tooling - stated as facts, not explanations]

## Filesystem Map
[BFS depth map - what exists where, 2 levels deep]

## Vocabulary
[Project-specific terms the agent needs to use correctly]
```

**Verification criteria:**
1. Line count is under 200
2. Every line passes the removal test: removing it would change agent behaviour
3. No line explains WHY a convention exists - only WHAT the convention is
4. Quality gate section contains runnable commands
5. An agent reading this file would know: what to build, how to verify, what conventions
   to follow, and where to find things

**Extension:** Give your AGENTS.md to a coding agent and ask it to complete a task in
your project. Compare the output quality to a run without the AGENTS.md. Note whether the
agent follows the conventions, uses the vocabulary, and respects the standing orders.

> **AGENTIC GROUNDING:** The AGENTS.md creation exercise is the highest-leverage challenge
> in this step. A well-designed grounding document changes every subsequent agent
> interaction with your project. A poorly designed one (too long, too vague, too
> comprehensive) can make agents worse (arXiv:2602.11988). If you build one thing from this
> step, build this. Start small. Add only what the agent needs. Test empirically.

---

## Challenge: Saturation Experiment

**Estimated time: 25 minutes**

**Goal:** Show empirically that adding more context can reduce output quality.

```python
#!/usr/bin/env python3
"""L8 saturation threshold experiment."""

import anthropic

client = anthropic.Anthropic()

task = """Write a Python function called parse_log_line that:
1. Takes a string: "2026-03-10 14:30:22 ERROR [auth] Login failed for user=admin"
2. Returns a dict with keys: timestamp, level, component, message
3. Raises ValueError for malformed lines
4. Include type hints"""

# Context levels: progressively add more grounding content
contexts = {
  "none": "",
  "minimal": "CONVENTIONS:\n- Python 3.11+, type hints required.\n"
    "- Raise specific exceptions, not generic Exception.\n- 2 spaces indentation.",
  "moderate": "CONVENTIONS:\n- Python 3.11+, type hints required.\n"
    "- Raise specific exceptions, not generic Exception.\n- 2 spaces indentation.\n"
    "- Use dataclasses for return types when dict has more than 3 keys.\n"
    "- All regex patterns stored as module-level compiled constants.\n"
    "- Docstrings use Google style.\n- Functions over 20 lines should be split.\n"
    "- Prefer str methods over regex for simple parsing.",
  "heavy": "CONVENTIONS:\n- Python 3.11+, type hints required.\n"
    "- Raise specific exceptions, not generic Exception.\n- 2 spaces indentation.\n"
    "- Use dataclasses for return types when dict has more than 3 keys.\n"
    "- All regex patterns stored as module-level compiled constants.\n"
    "- Docstrings use Google style.\n- Functions over 20 lines should be split.\n"
    "- Prefer str methods over regex for simple parsing.\n"
    "- All string constants defined at module level.\n"
    "- Use __slots__ on all dataclasses.\n"
    "- Custom exceptions inherit from a project base exception.\n"
    "- Logging uses structlog, not stdlib logging.\n"
    "- All public functions need @overload decorators for union types.\n"
    "- Return types use TypeAlias for complex types.\n"
    "- Use Final for module-level constants.\n"
    "- Pattern matching (match/case) preferred over if/elif chains.\n"
    "- All I/O functions must be async-compatible.\n"
    "- UTC timestamps only in all internal representations."
}

for level, context in contexts.items():
  system = f"You are a Python developer.\n{context}" if context else \
    "You are a Python developer."
  response = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system=system, messages=[{"role": "user", "content": task}]
  )
  code = response.content[0].text
  has_hints = "->" in code
  has_error = "ValueError" in code
  print(f"\n{level}: {response.usage.output_tokens} tokens, "
    f"type_hints={has_hints}, ValueError={has_error}")
  for line in code.split("\n")[:15]:
    print(f"  {line}")
```

**Verification:** Compare the four outputs:
- Does the "none" version complete the task correctly?
- Does the "minimal" version follow the conventions?
- Does the "moderate" version follow all specified conventions, or does it miss some?
- Does the "heavy" version follow more conventions or fewer than "moderate"?

The expected pattern: "minimal" and "moderate" should produce the best task completion.
"Heavy" should show signs of distraction - the model trying to follow 20 conventions
simultaneously and getting confused about which take priority for this specific task.

**What you are learning:** This is the saturation threshold in action. "More role content
is not monotonically better." The working set for this task is the "minimal" context plus
the task itself. Everything beyond that is noise consuming attention.

---

## Challenge: Chain-of-Thought Toggle

**Estimated time: 15 minutes**

**Goal:** Measure when reasoning tokens add value and when they are waste.

```python
#!/usr/bin/env python3
"""Chain-of-thought toggle experiment."""

import anthropic
import time

client = anthropic.Anthropic()

simple_task = "Write a Python function that reverses a string. Include type hints."

complex_task = """A system has three services: Auth, Billing, and Notifications.
Auth depends on nothing. Billing depends on Auth. Notifications depends on both.
Each service can be: stopped, starting, running. A service can only start if all
its dependencies are running. Transition takes 2 seconds.

Write start_system() that starts all services in correct order with dependency
checking. Return total time to all-running. Handle dependency start failure."""

for task_name, task in [("Simple", simple_task), ("Complex", complex_task)]:
  print(f"\n{'='*60}\nTask: {task_name}")

  start = time.time()
  r_no = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=4096,
    messages=[{"role": "user", "content": task}]
  )
  t_no = time.time() - start

  start = time.time()
  r_yes = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 5000},
    messages=[{"role": "user", "content": task}]
  )
  t_yes = time.time() - start

  print(f"  Without thinking: {r_no.usage.output_tokens} tokens, {t_no:.1f}s")
  print(f"  With thinking:    {r_yes.usage.output_tokens} tokens, {t_yes:.1f}s")
  for block in r_yes.content:
    if block.type == "thinking":
      print(f"  Thinking chars:   {len(block.thinking)}")
  print(f"  Delta: {t_yes - t_no:+.1f}s, "
    f"{r_yes.usage.output_tokens - r_no.usage.output_tokens:+d} tokens")
```

**Verification:**
- For the simple task, thinking should add latency and tokens with little quality
  improvement. A string reversal function is a string reversal function.
- For the complex task, thinking should improve the output - particularly around dependency
  ordering and failure handling - at a cost of more tokens and latency.
- The ratio of benefit to cost should be clearly different between the two tasks.

**What you are learning:** Extended thinking is a tool, not a default. Enable it when the
task requires multi-step reasoning. Disable it when the task is straightforward. The cost
is real (tokens, latency, money). The benefit is task-dependent.

---

## Key Takeaways

Before moving to Step 4, you should be able to answer these questions without looking
anything up:

1. What is the difference between a decorative role prompt and a functional role prompt?
   How do you test which one you have?

2. Why does the system prompt occupy a structurally privileged position in the context
   window? What is the mechanism (from Step 1) that creates this privilege?

3. When should you use XML vs JSON vs YAML for structured output? What is the escaping
   problem with JSON?

4. What is the diminishing returns curve for few-shot examples? At what point do additional
   examples start hurting more than helping?

5. What is ACI design? Why did Anthropic's SWE-bench team spend more time on tool
   definitions than on the overall prompt?

6. What is poka-yoke and how does it apply to tool definitions? Give one concrete example.

7. What is the working set concept? How does it relate to Denning's 1968 virtual memory
   definition?

8. What did arXiv:2602.11988 find about repository-level context files? How does this
   connect to the L8 saturation threshold?

9. What are the four signals that you are using prompt engineering as a substitute for
   system design?

10. When does extended thinking help and when does it waste tokens? What type of task
    benefits most from reasoning tokens?

---

## Recommended Reading

- **Anthropic Prompt Engineering Interactive Tutorial** -
  `github.com/anthropics/courses/tree/master/prompt_engineering_interactive_tutorial`.
  Nine chapters, basic to advanced. The best structured introduction to Claude prompting.

- **"Building effective agents"** - Schluntz and Zhang, Anthropic (Dec 2024). Appendix 2
  covers ACI design: poka-yoke for tools, the SWE-bench tool optimisation finding.

- **OpenAI Prompt Engineering Guide** - `platform.openai.com/docs/guides/prompt-engineering`.
  Message hierarchy, prompt structure, model-specific guidance for reasoning models.

- **arXiv:2602.11988** - Gloaguen et al. (2026). "Evaluating AGENTS.md: Are Repository-Level
  Context Files Helpful for Coding Agents?" First empirical evaluation of grounding
  documents. Unnecessary context reduces task success, increases cost 20%.

- **This project: `AGENTS.md`** - Worked example. ~450 lines of operational specification.

- **This project: `docs/internal/layer-model.md`** - Full L8 entry with saturation details.

---

## What to Read Next

**Step 4: Context Engineering** - Prompt engineering tells the model what to do. Context
engineering tells the model what to know. Step 4 covers the working set in depth, the five
context engineering concepts (working set, dumb zone, cold/hot context pressure, compaction
loss), and practical techniques for managing context window budget across long sessions.
Step 3 covers static content (prompts, grounding documents). Step 4 covers dynamic content
(conversation history, tool results) and what happens when the context window fills up.

**Step 5: Tool Use and Function Calling** - The ACI design principles from Section 5 are
the foundation for Step 5's deeper treatment of tool calling at L7: how calls flow through
the API, how results enter context, and how to design tool ecosystems where the model
selects the right tool for the right task.

