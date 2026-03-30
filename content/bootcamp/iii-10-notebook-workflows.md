+++
title = "Notebook-Based Analysis Workflows"
date = "2026-03-10"
description = "Notebook organisation, reproducibility, the exploration-to-script pipeline, analysis templates."
tags = ["jupyter", "notebooks", "workflows", "bootcamp"]
step = 10
tier = 3
estimate = "2-3 hours"
bootcamp = 3
+++

Step 10 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Bootcamp I Step 5.10 introduced Jupyter: how to start the server, create cells, run code, restart the kernel. That was the mechanics. This step covers the discipline.

The difference matters. An undisciplined notebook is a liability: cells run out of order, hidden state from deleted cells persists, output committed to git inflates diffs by 10-100x, dependencies are implicit, and six months later neither you nor anyone else can reproduce the analysis. Every analyst who has opened a colleague's `Untitled7.ipynb` and tried to make it run has experienced this failure mode firsthand.

An analysis notebook in an agentic engineering context carries additional weight. When the Operator asks "should we add a fourth model to the review pipeline?", the answer is not a gut feeling. It is a notebook that loads three runs of `bin/triangulate` output, computes marginal value curves, overlays cost data, and presents a recommendation with supporting evidence. That notebook is an artifact. It must be reproducible, version-controlled, and structured so that someone (including future-you) can follow the reasoning.

The goal: treat notebooks as the Operator's analytical workbench, with the same discipline you apply to production code, but adapted for exploration.

---

## Table of Contents

1. [Notebook Organization](#1-notebook-organization) (~20 min)
2. [Reproducibility](#2-reproducibility) (~25 min)
3. [The Exploration-to-Script Pipeline](#3-the-exploration-to-script-pipeline) (~30 min)
4. [Magic Commands for Analytics](#4-magic-commands-for-analytics) (~20 min)
5. [nbstripout and Version Control](#5-nbstripout-and-version-control) (~25 min)
6. [Analysis Templates](#6-analysis-templates) (~20 min)
7. [Challenges](#7-challenges) (~40-60 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. Notebook Organization

*Estimated time: 20 minutes*

A notebook should answer one question. Not three questions. Not "various explorations from Tuesday." One question, stated in the filename and in the first cell.

### Naming Convention

Use date-prefixed, descriptive names:

```
2026-03-10-convergence-trend-analysis.ipynb
2026-03-08-marginal-value-fourth-model.ipynb
2026-03-05-severity-calibration-across-models.ipynb
```

The date prefix does three things: it sorts notebooks chronologically in a directory listing, it tells you when the analysis was done, and it prevents name collisions when you revisit the same question months later.

Avoid these:

```
Untitled.ipynb
Untitled7.ipynb
analysis.ipynb
test.ipynb
final_v2_FINAL.ipynb
```

If you cannot name the notebook, you do not yet know what question you are answering. Figure that out first.

### Directory Structure

Keep notebooks in a dedicated directory, separate from source code:

```
notebooks/
  2026-03-10-convergence-trend-analysis.ipynb
  2026-03-08-marginal-value-fourth-model.ipynb
  lib/                # extracted modules (see Section 3)
    metrics.py
    loaders.py
```

The `lib/` subdirectory holds Python modules extracted from notebooks. This separation matters: notebooks are exploration artifacts, modules are reusable code. They have different lifecycles and different quality bars.

> **AGENTIC GROUNDING:** When an agent generates a notebook, it almost always names it generically (`analysis.ipynb`, `exploration.ipynb`) and dumps multiple unrelated analyses into a single file. The Operator's job is to enforce the one-question-per-notebook rule and rename the file before it enters version control. A notebook named `Untitled3.ipynb` in a git history is a signal that nobody reviewed the analysis workflow.

---

## 2. Reproducibility

*Estimated time: 25 minutes*

A notebook that only runs on your machine, with your hidden state, on the day you wrote it, is not an analysis. It is a screenshot. Reproducibility requires three things: declared dependencies, stable paths, and a clean kernel.

### Declaring Dependencies

Bootcamp I Step 5.4 covered PEP 723 inline metadata for scripts. Notebooks do not natively support PEP 723, but you can declare your dependencies in the first cell as a comment block and use it as documentation:

```python
# /// notebook
# requires-python = ">=3.11"
# dependencies = [
#   "pandas>=2.0",
#   "matplotlib>=3.7",
#   "pyyaml>=6.0",
#   "seaborn>=0.12",
# ]
# ///

# Install dependencies (run once):
# uv pip install pandas matplotlib pyyaml seaborn
```

This first cell serves as a manifest. Anyone opening the notebook knows exactly what to install. The comment block mirrors PEP 723 syntax so the convention is familiar from script work.

### Pinning Paths

Use a project root and build all paths relative to it:

```python
from pathlib import Path

# Pin to the project root (one level up from notebooks/)
PROJECT_ROOT = Path("..").resolve()
DATA_DIR = PROJECT_ROOT / "data" / "alley"
DOCS_DIR = PROJECT_ROOT / "docs" / "internal"

# Load data using pinned paths
catch_log = DATA_DIR.parent.parent / "docs" / "internal" / "weaver" / "catch-log.tsv"
```

Never use absolute paths like `/home/yourname/projects/midgets/data/`. Never use relative paths that depend on the notebook server's working directory. `Path("..").resolve()` anchors you to a known location regardless of how Jupyter was started.

### Autoreload

When you extract code into a `.py` module (covered in Section 3), you need changes to that module to take effect in the notebook without restarting the kernel. The `autoreload` extension handles this:

```python
%load_ext autoreload
%autoreload 2
```

Put this in the first cell, before any imports. `%autoreload 2` reloads all modules before every cell execution. This means you can edit `lib/metrics.py` in your editor and the next cell you run in the notebook picks up the change immediately.

### The "Restart and Run All" Test

The single most important reproducibility check: **Kernel > Restart & Run All**. If the notebook does not execute cleanly from top to bottom after a fresh kernel restart, it is broken. Cells that depend on out-of-order execution, deleted cells, or interactive state will fail this test.

Run this test before committing. Run it before sharing. Run it before drawing conclusions from the output.

> **AGENTIC GROUNDING:** Agents do not maintain kernel state between sessions. Every agent interaction with a notebook is effectively a "Restart and Run All." If the notebook fails that test, it is useless to agents. Building notebooks that pass this test is not extra work - it is the minimum bar for an analysis artifact that persists beyond the current session.

---

## 3. The Exploration-to-Script Pipeline

*Estimated time: 30 minutes*

The notebook is the lab. The script is the factory.

This is the central workflow discipline for analytical work. Exploration - loading data, trying transformations, plotting different views, testing hypotheses - belongs in a notebook. Once you have found something that works and needs to be repeated, you extract it into a Python script or module.

### The Pipeline

```
Notebook (explore) --> Module (extract) --> Script (automate)
```

1. **Explore** in the notebook. Try things. Plot. Iterate. This is fast and messy.
2. **Extract** the working code into a `.py` module. Clean it up. Add type hints. Add a docstring.
3. **Automate** by importing the module in a script with `argparse`, or by importing it back into future notebooks.

### Concrete Example: Before and After

In a notebook, you might have a cell that loads and normalizes catch-log data:

```python
# Notebook cell - exploration phase
import pandas as pd

df = pd.read_csv("../docs/internal/weaver/catch-log.tsv", sep="\t")
df.columns = df.columns.str.strip()
df["agent"] = df["agent"].str.lower().str.replace(r"\(.*\)", "", regex=True).str.strip()
df["date"] = pd.to_datetime(df["date"])

# Quick look
df.groupby("outcome").size()
```

This works. You have confirmed the loading logic, the column cleaning, and the agent normalization. Now extract it:

```python
# notebooks/lib/loaders.py - extracted module
"""Data loaders for project analytical sources."""

from pathlib import Path

import pandas as pd


def load_catch_log(path: Path) -> pd.DataFrame:
  """Load and normalize the catch log TSV.

  Normalizes agent names to lowercase without annotations
  (e.g. 'operator(L12)' becomes 'operator').
  Parses date column to datetime.
  """
  df = pd.read_csv(path, sep="\t")
  df.columns = df.columns.str.strip()
  df["agent"] = (
    df["agent"]
    .str.lower()
    .str.replace(r"\(.*\)", "", regex=True)
    .str.strip()
  )
  df["date"] = pd.to_datetime(df["date"])
  return df
```

Back in the notebook, the cell becomes:

```python
# Notebook cell - after extraction
from lib.loaders import load_catch_log

df = load_catch_log(PROJECT_ROOT / "docs" / "internal" / "weaver" / "catch-log.tsv")
df.groupby("outcome").size()
```

The exploration stays in the notebook. The reusable logic lives in the module. The notebook is shorter, clearer, and imports tested code instead of repeating raw transformations.

### Real Example: triangulate

The `bin/triangulate` script in this project follows exactly this pattern. The matching algorithm - computing pairwise similarity between findings using `difflib.SequenceMatcher`, greedy best-first assignment, convergence grouping - was first explored interactively. Questions like "what similarity threshold separates true matches from false matches?" and "does file path similarity help or hurt?" are exploration questions. They belong in a notebook.

Once the algorithm was proven, it was extracted into `bin/triangulate` as a standalone script with `argparse`, structured output, and five export products. The notebook was the lab. The script is the factory. The script runs in CI, in Makefile targets, and as a polecat task. The notebook stays in the `notebooks/` directory as the provenance for why the algorithm works the way it does.

> **AGENTIC GROUNDING:** Agents generate scripts, not notebooks. When an agent writes `bin/triangulate`, it produces the factory directly. But the Operator needs the lab - the exploratory work that validates the algorithm before it becomes a script. This is a division of labor: the Operator explores in notebooks, proves the approach, then either extracts the script manually or instructs an agent to write the script based on the proven notebook logic. The notebook is the specification; the script is the implementation.

> **HISTORY:** The phrase "notebook is the lab, script is the factory" comes from data science practice at Netflix and Spotify in the 2010s, where analytics teams discovered that notebooks left in production Airflow pipelines were the single largest source of silent failures. The lab-to-factory pipeline became standard practice: explore in notebooks, promote to tested scripts, run scripts in production. The notebook never runs unattended.

---

## 4. Magic Commands for Analytics

*Estimated time: 20 minutes*

IPython magic commands are prefixed with `%` (line magics) or `%%` (cell magics). A handful of them are genuinely useful for analytical work. The rest are noise.

### Cell Timing: `%%time` and `%%timeit`

`%%time` measures wall time and CPU time for a single cell execution:

```python
%%time
df = pd.read_csv("../docs/internal/weaver/catch-log.tsv", sep="\t")
merged = df.merge(events_df, on="date", how="left")
```

Output:

```
CPU times: user 12.3 ms, sys: 1.2 ms, total: 13.5 ms
Wall time: 14.1 ms
```

Use `%%time` when you want to know how long a specific operation takes. This matters when loading large files or running expensive computations - it tells you where the time goes.

`%%timeit` runs the cell multiple times and reports statistics:

```python
%%timeit -n 100 -r 3
df.groupby("outcome").size()
```

Output:

```
1.23 ms +/- 45.6 us per loop (mean +/- std. dev. of 3 runs, 100 loops each)
```

Use `%%timeit` when comparing two approaches. The statistical summary (mean and standard deviation over multiple runs) gives you a reliable comparison, not a single noisy measurement.

### Shell Commands: `%%bash`

Run shell commands directly from a notebook cell:

```python
%%bash
wc -l ../docs/internal/weaver/catch-log.tsv
head -1 ../docs/internal/weaver/catch-log.tsv
```

This is useful for quick filesystem checks without leaving the notebook. For anything more complex, use Python's `subprocess` module or extract it to a script.

### Inline Plots: `%matplotlib inline`

```python
%matplotlib inline
```

This makes matplotlib plots render directly in the notebook output. Put it in your setup cell, once, at the top. Without it, plots either do not appear or open in a separate window.

### Variable Persistence: `%store`

`%store` saves a variable to IPython's internal database, so you can retrieve it in another notebook or after a kernel restart:

```python
# In notebook A
%store convergence_rate

# In notebook B (or after restart)
%store -r convergence_rate
```

Use this sparingly. It creates hidden state that violates reproducibility. If you need to share data between notebooks, write it to a file (CSV, YAML, pickle). `%store` is acceptable for quick ad hoc sharing during a single exploration session, not for anything that needs to persist.

### What Not to Use

IPython has dozens of magic commands. Most are irrelevant for analytics work. Avoid getting distracted by `%who`, `%whos`, `%prun`, `%debug`, `%%latex`, `%%html`, and the rest unless you have a specific need. The five commands above (`%%time`, `%%timeit`, `%%bash`, `%matplotlib inline`, `%store`) cover the common cases.

> **AGENTIC GROUNDING:** Agents generating notebook cells sometimes insert magic commands they have seen in training data without understanding the context. `%matplotlib notebook` (interactive backend) causes rendering failures in non-browser environments. `%autosave 0` disables autosave silently. If an agent generates a notebook, review the magic commands in the first few cells before running anything.

---

## 5. nbstripout and Version Control

*Estimated time: 25 minutes*

Committing notebook output to version control is a known anti-pattern. This section explains why and gives you the standard fix.

### The Problem

A Jupyter notebook (`.ipynb`) is a JSON file. It contains three types of content:

1. **Source cells** - the code and markdown you wrote
2. **Output cells** - the results of running the code (text, tables, images, errors)
3. **Metadata** - kernel info, execution counts, cell IDs

When you commit a notebook with output, the output is embedded in the JSON. This causes three problems:

**Large diffs.** A plot is stored as a base64-encoded PNG inside the JSON. A single matplotlib figure can add 50-200 KB of base64 text to the file. Change one line of code and re-run the cell, and git sees a 200 KB diff even though the meaningful change was one line.

**Secrets in output.** If a cell prints environment variables, API keys, database connection strings, or file paths containing usernames, those values are stored in the notebook output. They end up in git history permanently.

**Merge conflicts.** Two people run the same notebook and get different execution counts, different output order, different plot renders. Every cell output differs. The merge is impossible to resolve meaningfully.

### The Solution: nbstripout

`nbstripout` is a git filter that strips output and metadata from notebooks before they are staged for commit. You write and run notebooks normally. When you `git add`, the filter automatically removes output. The committed version contains only source cells.

### Setup

```bash
uv pip install nbstripout && nbstripout --install
```

That is two commands. The first installs the tool. The second configures git filters in the current repository's `.git/config` and `.gitattributes`.

After running `nbstripout --install`, verify the configuration:

```bash
# Check git config
git config --list | grep filter.nbstripout
```

Expected output:

```
filter.nbstripout.clean=nbstripout
filter.nbstripout.smudge=cat
filter.nbstripout.required=true
```

```bash
# Check .gitattributes
cat .gitattributes
```

Expected output (may include other entries):

```
*.ipynb filter=nbstripout
```

### Verification

Create a test notebook, run it, and verify that the committed version has no output:

```bash
# Create and run a notebook (or use an existing one with output)
# Then stage and inspect:
git diff --cached -- notebooks/test.ipynb
```

The diff should show source cells but no output cells. If you see `"outputs": [` followed by content, nbstripout is not configured correctly.

### Manual Stripping

If you need to strip output without committing (for example, to share a clean notebook by email):

```bash
nbstripout notebooks/2026-03-10-convergence-trend-analysis.ipynb
```

This modifies the file in place, removing all output cells.

> **AGENTIC GROUNDING:** If you set up a repository for agentic analysis work and forget to install nbstripout, the first notebook commit will inflate the repository size. The second commit will create an unreadable diff. By the tenth commit, `git log -p` on notebook files is useless. nbstripout is not optional tooling - it is infrastructure. Install it the same day you create the `notebooks/` directory. The setup is two commands and it prevents a class of problems that cannot be fixed retroactively without rewriting git history.

---

## 6. Analysis Templates

*Estimated time: 20 minutes*

A template is not bureaucracy. It is a checklist that prevents you from skipping the parts of an analysis that matter most: stating the question, validating the data, and recording what you found.

### The Five Sections

Every analysis notebook should contain these five sections, in this order:

### Context

The first markdown cell. States what question the analysis answers, what data it uses, and when it was created.

```markdown
# Convergence Trend Analysis

**Question:** Is the 3-model convergence rate improving across runs?
**Data:** triangulate metrics exports from data/alley/run-{01..05}/metrics.yaml
**Date:** 2026-03-10
**Author:** Operator
```

This is not decoration. Six months from now, this cell is the only thing that tells you why this notebook exists. Write it first. If you cannot fill it in, you are not ready to start the analysis.

### Data Loading

Load and validate the data. Print shape, dtypes, and a sample. Check for nulls and unexpected values.

```python
import pandas as pd
import yaml
from pathlib import Path

PROJECT_ROOT = Path("..").resolve()

# Load metrics from five runs
runs = []
for run_dir in sorted((PROJECT_ROOT / "data" / "alley").glob("run-*")):
  with open(run_dir / "metrics.yaml") as f:
    metrics = yaml.safe_load(f)
  metrics["run_id"] = run_dir.name
  runs.append(metrics)

print(f"Loaded {len(runs)} runs")

# Validate: expect 5 runs
assert len(runs) == 5, f"Expected 5 runs, got {len(runs)}"
```

The validation is not paranoia. Data changes. Files get moved. Schemas evolve. An assertion that fails immediately is worth more than a subtle wrong answer three cells later.

### Analysis

The actual work. This section will vary by question. It might be a single cell with a groupby, or it might be twenty cells with plots, statistical tests, and intermediate transformations.

The one rule: each cell should do one thing and have a comment or markdown cell above it explaining what it does and why. "Compute per-run convergence rate" is a good cell header. A cell with no explanation that produces a DataFrame with no context is not analysis - it is a code dump.

### Findings

A markdown cell summarizing what the analysis shows. Bullet points. Supported by specific numbers from the analysis cells above.

```markdown
## Findings

- Convergence rate (all 3 models agree) improved from 0.31 (run-01) to 0.48 (run-05)
- The improvement is not monotonic: run-03 dropped to 0.28 (prompt regression, reverted in run-04)
- Marginal value of the third model decreased from 4.2 unique findings (run-01) to 1.8 (run-05)
- At current rates, the third model costs $2.40/run for 1.8 unique findings ($1.33/finding)
```

State what you found. Do not hedge with "it seems like" or "this might suggest." If the data shows it, say so. If the data does not show it, say that.

### Next Steps

What to do with the findings. Concrete actions, not vague intentions.

```markdown
## Next Steps

- [ ] Run a formal cost-benefit analysis on the third model (Step 8 methodology)
- [ ] Test whether the convergence improvement holds on a different codebase
- [ ] If marginal value continues declining, propose dropping to 2-model review in SD-XXX
```

This section closes the loop. The analysis answered a question. The answer implies actions. Record them while the context is fresh.

> **AGENTIC GROUNDING:** When you ask an agent to generate an analysis notebook, it will produce code cells with output. It will almost never produce a Context cell, a Findings cell, or a Next Steps cell. Those sections require human judgment - they are L12 work. The template is a checklist for the Operator: after the agent generates the computational cells, add the framing (Context, Findings, Next Steps) that turns code output into an analysis.

---

## 7. Challenges

*Estimated time: 40-60 minutes total*

---

## Challenge: Build an Analysis Notebook from Template

**Estimated time: 15 minutes**

**Goal:** Create a properly structured analysis notebook using the five-section template.

1. Create a new notebook named `2026-03-10-catch-log-outcome-distribution.ipynb` in a `notebooks/` directory.

2. Add the Context cell:

```markdown
# Catch Log Outcome Distribution

**Question:** What is the distribution of outcomes (logged, fixed, blocked, scrubbed) in the catch log?
**Data:** docs/internal/weaver/catch-log.tsv
**Date:** 2026-03-10
**Author:** (your name)
```

3. Add the Data Loading cell:

```python
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path("..").resolve()
df = pd.read_csv(
  PROJECT_ROOT / "docs" / "internal" / "weaver" / "catch-log.tsv",
  sep="\t"
)
df.columns = df.columns.str.strip()
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"Outcomes: {df['outcome'].unique()}")
```

4. Add an Analysis cell that computes `df["outcome"].value_counts()` and a bar chart.

5. Add Findings and Next Steps cells based on what you see.

6. Run **Kernel > Restart & Run All** and verify it passes.

**Verification:** The notebook runs cleanly from top to bottom after a kernel restart. All five template sections are present.

---

## Challenge: Extract a Loader Module

**Estimated time: 15 minutes**

**Goal:** Extract the data loading logic from the previous challenge into a reusable module.

1. Create `notebooks/lib/__init__.py` (empty file).

2. Create `notebooks/lib/loaders.py` with:

```python
"""Data loaders for project analytical sources."""

from pathlib import Path

import pandas as pd


def load_catch_log(path: Path) -> pd.DataFrame:
  """Load and normalize the catch log TSV.

  Returns a DataFrame with stripped column names,
  normalized agent names, and parsed dates.
  """
  df = pd.read_csv(path, sep="\t")
  df.columns = df.columns.str.strip()
  df["agent"] = (
    df["agent"]
    .str.lower()
    .str.replace(r"\(.*\)", "", regex=True)
    .str.strip()
  )
  df["date"] = pd.to_datetime(df["date"])
  return df
```

3. Update your analysis notebook to use the module:

```python
%load_ext autoreload
%autoreload 2

from lib.loaders import load_catch_log

df = load_catch_log(PROJECT_ROOT / "docs" / "internal" / "weaver" / "catch-log.tsv")
```

4. Verify: change something in `loaders.py` (add a print statement), re-run the import cell, and confirm the change takes effect without restarting the kernel.

**Verification:** The notebook imports from the module. Changes to the module are picked up by autoreload without kernel restart.

**Extension:** Add a `load_events()` function to the same module that loads `events.yaml`, unwraps the `events` key, and returns a DataFrame with a combined `datetime` column from the `date` and `time` fields.

---

## Challenge: Set Up nbstripout

**Estimated time: 10 minutes**

**Goal:** Install and verify nbstripout for the repository.

1. Install and configure:

```bash
uv pip install nbstripout && nbstripout --install
```

2. Verify the git configuration:

```bash
git config --list | grep filter.nbstripout
```

You should see `filter.nbstripout.clean`, `filter.nbstripout.smudge`, and `filter.nbstripout.required`.

3. Run a notebook so it has output in the cells.

4. Stage the notebook and inspect the staged version:

```bash
git add notebooks/2026-03-10-catch-log-outcome-distribution.ipynb
git diff --cached -- notebooks/2026-03-10-catch-log-outcome-distribution.ipynb | head -50
```

5. Confirm that `"outputs"` arrays in the diff are empty (`"outputs": []`).

**Verification:** The staged notebook contains no output cells. The working copy still has output (you can still see results in Jupyter). Only the git-staged version is stripped.

> **AGENTIC GROUNDING:** If an agent creates a notebook and commits it without nbstripout configured, the output cells are in git history permanently. You can strip them from future commits, but the historical bloat remains unless you rewrite history with `git filter-branch` or BFG Repo-Cleaner. Setting up nbstripout before the first notebook commit prevents this entirely. Two commands, once, per repository.

---

## Challenge: Build a Dashboard Template

**Estimated time: 15 minutes**

**Goal:** Create a reusable notebook template for agent review analysis.

1. Create `notebooks/templates/agent-review-template.ipynb` with the following cell structure (markdown and code cells, no output):

Cell 1 (markdown):

```markdown
# Agent Review: [RUN-ID]

**Question:** How did the agents perform in this review run?
**Data:** data/alley/[RUN-ID]/metrics.yaml, convergence.yaml, findings-union.yaml
**Date:** [DATE]
**Author:** [NAME]
```

Cell 2 (code) - Setup:

```python
%matplotlib inline

import yaml
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

PROJECT_ROOT = Path("..").resolve()
RUN_ID = "CHANGE-ME"  # Set this to the actual run ID
RUN_DIR = PROJECT_ROOT / "data" / "alley" / RUN_ID
```

Cell 3 (code) - Data loading with validation:

```python
with open(RUN_DIR / "metrics.yaml") as f:
  metrics = yaml.safe_load(f)

print(f"Run: {RUN_ID}")
print(f"Reviews: {len(metrics.get('finding_count', {}))}")
```

Cell 4 (markdown) - Finding Count Summary header
Cell 5 (code) - Placeholder for finding count table
Cell 6 (markdown) - Convergence Analysis header
Cell 7 (code) - Placeholder for convergence rate computation
Cell 8 (markdown) - Severity Distribution header
Cell 9 (code) - Placeholder for severity bar chart
Cell 10 (markdown) - Findings
Cell 11 (markdown) - Next Steps

2. The template should pass **Kernel > Restart & Run All** if the data directory exists and contains the expected files (it will fail on missing data, which is expected for a template).

**Verification:** The template has all five analysis sections (Context, Data Loading, Analysis split into three sub-analyses, Findings, Next Steps). The code cells use pinned paths relative to `PROJECT_ROOT`. No magic commands beyond `%matplotlib inline` in the setup cell.

---

## Key Takeaways

Before considering this step complete, verify you can answer these without looking anything up:

1. What naming convention should notebooks follow, and why does the date prefix matter?
2. How do you declare dependencies in the first cell of a notebook?
3. What does `%autoreload 2` do, and why is it essential when extracting code to modules?
4. What is the "Restart and Run All" test, and when should you run it?
5. What is the difference between `%%time` and `%%timeit`?
6. Why is committing notebook output to git an anti-pattern? Name three specific problems it causes.
7. What two commands set up nbstripout for a repository?
8. What are the five sections of the analysis template, and which ones require human judgment?
9. When should code stay in a notebook vs. get extracted to a Python module?
10. What is the relationship between a notebook and a script in the lab-to-factory pipeline?

---

## Recommended Reading

- **"Ten Simple Rules for Reproducible Research in Jupyter Notebooks"** - Rule et al. (2019). Practical checklist from researchers who learned these lessons empirically. Available on arXiv (1810.08055).

- **nbstripout documentation** - `github.com/kynan/nbstripout`. Short README covering all configuration options, including per-file overrides and CI integration.

- **IPython documentation, Built-in Magic Commands** - `ipython.readthedocs.io/en/stable/interactive/magics.html`. The authoritative reference for all magic commands. Skim it once to know what exists; use the five commands from Section 4 daily.

- **"I Don't Like Notebooks"** - Joel Grus, JupyterCon 2018 talk. The strongest articulation of notebook anti-patterns. Watching this before adopting notebooks professionally is the equivalent of reading the safety manual before operating the equipment. The lab-to-factory pipeline in Section 3 addresses most of his objections.

---

## What to Read Next

This is the final step of Bootcamp III. If you have worked through the curriculum in order, you now have the analytical toolkit to answer operational questions about agentic systems: descriptive statistics, SQL analytics, statistical testing, time series, visualization, log parsing, cost modeling, text analysis, and notebook workflows.

The next step is not another tutorial. It is practice. Pick a real question from your agentic engineering work - "Is model X finding bugs that model Y misses?", "Is our review cost trending up?", "Which slopodar patterns recur most often?" - open a notebook, apply the template from Section 6, and answer it. The curriculum gave you the tools. The work gives you the judgment.

