+++
title = "Visualisation for Decision-Making"
date = "2026-03-10"
description = "matplotlib, the right chart for the question, multi-panel figures, heatmaps, annotations."
tags = ["visualisation", "matplotlib", "bootcamp"]
step = 6
tier = 2
estimate = "4-5 hours"
bootcamp = 3
+++

Step 6 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

A table of numbers showing convergence rate per run is data. A line chart showing
convergence rate climbing over 10 runs is a pattern you can act on. Visualization is
not decoration - it is the fastest path from data to pattern recognition.

Agents generate metrics, review findings, cost records, and event logs. The Operator
needs to answer questions about that data: "Is this metric trending up?" "Are these
distributions different?" "Where are the outliers?" "Did the prompt change actually
improve convergence?" A table with 200 rows cannot answer these questions at a glance.
A plot can.

The project's `bin/triangulate` script exports convergence matrices, severity
distributions, and marginal value curves as structured YAML. The events log and
catch-log record temporal data. This step teaches you to turn those exports into
functional plots that answer operational questions. The YAML HUD is the project's
text-based status reporting. Visualization is its graphical complement.

matplotlib is the tool because it is the substrate. Every Python plotting library -
seaborn, plotly, altair - builds on or wraps matplotlib. Understanding the object
model means you can debug any plotting code, integrate with any framework, and produce
exactly the chart you need without fighting an abstraction layer.

The goal is not beautiful charts. The goal is functional plots that answer questions.

---

## Table of Contents

1. [matplotlib Fundamentals](#1-matplotlib-fundamentals) (~40 min)
2. [The Right Chart for the Question](#2-the-right-chart-for-the-question) (~30 min)
3. [Multi-Panel Figures](#3-multi-panel-figures) (~40 min)
4. [Heatmaps](#4-heatmaps) (~30 min)
5. [Annotations and Reference Lines](#5-annotations-and-reference-lines) (~30 min)
6. [Saving and Exporting](#6-saving-and-exporting) (~20 min)
7. [Common Mistakes](#7-common-mistakes) (~30 min)
8. [Seaborn for Statistical Plots](#8-seaborn-for-statistical-plots) (~40 min)
9. [Challenges](#challenges) (~60-90 min)
10. [Key Takeaways](#key-takeaways)
11. [Recommended Reading](#recommended-reading)
12. [What to Read Next](#what-to-read-next)

---

## 1. matplotlib Fundamentals

*Estimated time: 40 minutes*

matplotlib has two interfaces. The **pyplot state machine** (`plt.plot()`,
`plt.xlabel()`) operates on a hidden "current figure" and "current axes" via global
state. It exists for quick interactive exploration and because MATLAB users expected
it in 2003. It works until you have more than one subplot, at which point the global
state becomes a source of subtle bugs - you call `plt.xlabel()` and it labels the
wrong axes because the "current" axes is not what you think it is.

The **object-oriented API** is explicit. You create a Figure and one or more Axes
objects, then call methods directly on the Axes you want to modify. There is no hidden
state. You always know which plot you are changing. This is what production code,
teaching material, and every matplotlib maintainer recommends.

This step teaches the OOP API exclusively. Every example starts with
`fig, ax = plt.subplots()`.

> **HISTORY:** matplotlib was created by John Hunter in 2003 as a MATLAB-compatible
> plotting library for Python. The pyplot state machine was a deliberate design choice
> to ease migration from MATLAB, where the "current figure" concept is fundamental. As
> matplotlib grew to handle complex multi-panel figures, the state machine's limitations
> became apparent. The OOP API was always there - pyplot was the convenience layer.
> Hunter died in 2012; the project continues under community governance. Understanding
> this history explains why tutorials from 2005-2015 use pyplot and why modern best
> practice avoids it.

### The Figure and Axes Model

A matplotlib plot has two core objects:

- **Figure** - the entire canvas. Controls overall size, background color, and contains
  one or more Axes. Created by `plt.subplots()` or `plt.figure()`.
- **Axes** - a single plot area with its own coordinate system, labels, title, and
  legend. This is where data gets drawn. One Figure can contain many Axes.

The relationship: a Figure contains Axes, like a page contains panels.

```python
import matplotlib.pyplot as plt

# Create one Figure with one Axes
fig, ax = plt.subplots(figsize=(8, 5))

# All plotting methods are called on ax, not plt
ax.plot([1, 2, 3, 4, 5], [10, 25, 15, 30, 20], marker='o')
ax.set_xlabel('Run Number')
ax.set_ylabel('Finding Count')
ax.set_title('Findings Per Review Run')

fig.tight_layout()
fig.savefig('findings_per_run.png', dpi=150, bbox_inches='tight')
```

Note the naming convention: pyplot uses bare names (`plt.xlabel`), the OOP API uses
`set_` prefixes (`ax.set_xlabel`). This is consistent across all Axes setter methods.

| pyplot (avoid)     | OOP (use this)         |
|--------------------|------------------------|
| `plt.plot(x, y)`   | `ax.plot(x, y)`        |
| `plt.xlabel('X')`  | `ax.set_xlabel('X')`   |
| `plt.ylabel('Y')`  | `ax.set_ylabel('Y')`   |
| `plt.title('T')`   | `ax.set_title('T')`    |
| `plt.xlim(0, 10)`  | `ax.set_xlim(0, 10)`   |
| `plt.legend()`     | `ax.legend()`          |
| `plt.savefig(f)`   | `fig.savefig(f)`       |

The only `plt.*` calls you should use are: `plt.subplots()` (creates the figure),
`plt.colorbar()` (adds a colorbar), `plt.show()` (displays interactively), and
`plt.close()` (frees memory). Everything else goes through `fig` or `ax`.

### Line Chart

Line charts show trends over a continuous or ordered variable. Use them for time
series, sequential runs, or any ordered dimension.

```python
import matplotlib.pyplot as plt

# Simulated: convergence rate improving over 10 triangulate runs
runs = list(range(1, 11))
convergence_rate = [0.35, 0.42, 0.48, 0.45, 0.55, 0.58, 0.62, 0.60, 0.68, 0.72]

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(runs, convergence_rate, marker='o', color='tab:blue', linewidth=1.5,
        label='Convergence Rate')
ax.set_xlabel('Run Number')
ax.set_ylabel('Convergence Rate (all models agree)')
ax.set_title('Cross-Model Convergence Over Triangulate Runs')
ax.set_ylim(0, 1.0)
ax.legend(loc='lower right')
fig.tight_layout()
```

Key parameters for `ax.plot()`:

| Parameter   | Purpose                                | Example values             |
|-------------|----------------------------------------|----------------------------|
| `marker`    | Show individual data points            | `'o'`, `'s'`, `'^'`, `'D'` |
| `linestyle` | Solid, dashed, dotted                  | `'-'`, `'--'`, `':'`, `'-.'` |
| `linewidth` | Line thickness                         | `1.5` (default)            |
| `color`     | Line color                             | `'tab:blue'`, `'#1f77b4'`  |
| `label`     | Text for legend entry                  | Any string                 |
| `alpha`     | Transparency (0.0 transparent - 1.0 opaque) | `0.7`                |

### Scatter Plot

Scatter plots show the relationship between two continuous variables. Each point is
one observation.

```python
import matplotlib.pyplot as plt

# Simulated: match confidence vs number of models that found the issue
match_confidence = [0.95, 0.82, 0.71, 0.65, 0.88, 0.92, 0.58, 0.77, 0.84, 0.69,
                    0.45, 0.38, 0.91, 0.73, 0.62]
convergence_count = [3, 3, 2, 2, 3, 3, 1, 2, 3, 2, 1, 1, 3, 2, 2]

fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(match_confidence, convergence_count, color='tab:blue', alpha=0.7, s=60)
ax.set_xlabel('Match Confidence')
ax.set_ylabel('Models Agreeing (Convergence Count)')
ax.set_title('Match Confidence vs Model Agreement')
ax.set_yticks([1, 2, 3])
fig.tight_layout()
```

Use the `c` parameter with a colormap to encode a third variable as color:

```python
fig, ax = plt.subplots(figsize=(8, 5))
scatter = ax.scatter(x_values, y_values, c=severity_scores,
                     cmap='viridis', alpha=0.7, s=60)
plt.colorbar(scatter, ax=ax, label='Severity Score')
```

### Bar Chart

Bar charts compare quantities across discrete categories. Use `ax.bar()` for vertical
bars, `ax.barh()` for horizontal bars (better when labels are long).

```python
import matplotlib.pyplot as plt

# Finding count per model from a triangulate run
models = ['Claude Opus', 'GPT-4o', 'Gemini Pro']
finding_counts = [14, 11, 9]

fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(models, finding_counts, color='steelblue', edgecolor='black')
ax.set_xlabel('Model')
ax.set_ylabel('Total Findings')
ax.set_title('Finding Count by Model')
fig.tight_layout()
```

### Histogram

Histograms show the distribution of a single continuous variable. The x-axis is
divided into bins; the y-axis is the count (or density) of observations in each bin.

```python
import matplotlib.pyplot as plt
import numpy as np

# Simulated: match confidence scores from convergence analysis
np.random.seed(42)
confidences = np.random.beta(5, 2, size=200)  # skewed toward high confidence

fig, ax = plt.subplots(figsize=(8, 5))
ax.hist(confidences, bins=25, color='steelblue', edgecolor='black', alpha=0.8)
ax.set_xlabel('Match Confidence')
ax.set_ylabel('Frequency')
ax.set_title('Distribution of Match Confidence Scores')
fig.tight_layout()
```

Bin count matters. Too few bins hide structure (bimodality disappears). Too many bins
create noise (every bin has 0-2 counts). Start with 20-30 bins for datasets with
hundreds of observations and adjust.

### Essential Labeling

Every chart needs three things: an x-axis label, a y-axis label, and a title. Include
units in parentheses when applicable.

```python
ax.set_xlabel('Response Time (ms)', fontsize=12)
ax.set_ylabel('Request Count', fontsize=12)
ax.set_title('API Response Time Distribution', fontsize=14)
```

Add a legend only when there are multiple series. A single-series chart does not need
one.

```python
ax.legend(loc='upper right', fontsize=10)
# loc options: 'best', 'upper left', 'upper right', 'lower left',
#              'lower right', 'center'
```

> **AGENTIC GROUNDING:** When an agent generates a plot, it almost never adds axis
> labels or a title. The output is a technically correct image that communicates nothing
> to a human reviewer. If you are reviewing agent-generated visualization code, the
> first check is whether `set_xlabel()`, `set_ylabel()`, and `set_title()` are called.
> If they are missing, the plot is incomplete. Treat missing labels the same way you
> treat a function with no docstring - technically functional, operationally useless.

---

## 2. The Right Chart for the Question

*Estimated time: 30 minutes*

The most common visualization mistake is not a formatting error. It is choosing the
wrong chart type. A pie chart showing 12 severity categories. A bar chart for a time
series. A scatter plot for categorical data. The chart type should be determined by the
question, not by what looks interesting.

### Decision Table

| Question                                     | Chart type          | API call                   |
|----------------------------------------------|---------------------|----------------------------|
| Is this metric trending up or down?          | Line chart          | `ax.plot()`                |
| How do these groups compare?                 | Bar chart           | `ax.bar()` / `ax.barh()`  |
| What does this distribution look like?       | Histogram           | `ax.hist()`                |
| How do distributions compare across groups?  | Box plot / Violin   | `sns.boxplot()` / `sns.violinplot()` |
| Are these two variables related?             | Scatter plot        | `ax.scatter()`             |
| How does this matrix look?                   | Heatmap             | `sns.heatmap()` / `ax.imshow()` |
| What is the composition of a total?          | Stacked bar         | `ax.bar()` with `bottom=`  |
| Where is a value relative to a threshold?    | Reference line      | `ax.axhline()` / `ax.axvline()` |

### Project Examples

Apply the decision table to the project's actual data:

**"Is convergence rate improving over runs?"** - This is a trend question. Use a line
chart with run number on the x-axis and convergence rate on the y-axis.

**"Which model finds the most issues?"** - This is a group comparison. Use a bar chart
with one bar per model, height = finding count.

**"What does the match confidence distribution look like?"** - This is a distribution
question. Use a histogram of match confidence values.

**"How does severity assignment compare across models?"** - This is a distribution
comparison across groups. Use a box plot with model on x-axis and severity ordinal on
y-axis, or a grouped bar chart of severity counts per model.

**"How well do models agree on specific findings?"** - This is a matrix question. Use
a heatmap of the convergence matrix - findings on one axis, models on the other, color
intensity = match confidence.

**"Did the control firing rate change after SD-318?"** - This is a trend question with
a change point. Use a line chart with a vertical reference line at the change date.

### Expanded Guidance

**"I want to show a trend"** - line chart. If comparing 2-3 trends, overlay them on
the same axes with different colors and a legend. If comparing 5 or more, use small
multiples (a grid of subplots, one per series) instead of overlaying.

**"I want to compare groups"** - bar chart for totals or counts, box plot for
distributions within each group, grouped bar chart when comparing two factors (e.g.,
model and severity).

**"I want to show correlation"** - scatter plot for two variables, heatmap for the
full correlation matrix of many variables.

**"I want to find outliers"** - box plot (outliers shown as individual points beyond
the whiskers) or scatter plot (visual inspection).

> **AGENTIC GROUNDING:** When the Operator asks "show me how the models compare,"
> the correct response depends on what "compare" means. Compare finding counts? Bar
> chart. Compare severity distributions? Box plot. Compare specific findings? Heatmap.
> Agents default to whatever chart type they have seen most often in training data,
> regardless of the question. The decision table is a checklist: identify the question
> type first, then select the chart.

---

## 3. Multi-Panel Figures

*Estimated time: 40 minutes*

A single figure with multiple subplots shows related views of the same data.
Side-by-side severity distributions for three models. Token usage trend above, cost
trend below. Four views of a triangulate export in one image.

### Creating Subplot Grids

```python
import matplotlib.pyplot as plt

# 2x2 grid of subplots
fig, axes = plt.subplots(nrows=2, ncols=2, figsize=(12, 8))

# axes is a 2D numpy array: axes[row, col]
axes[0, 0].plot(x, y1)
axes[0, 0].set_title('Top Left')

axes[0, 1].bar(categories, values)
axes[0, 1].set_title('Top Right')

axes[1, 0].hist(data, bins=20)
axes[1, 0].set_title('Bottom Left')

axes[1, 1].scatter(x2, y2)
axes[1, 1].set_title('Bottom Right')

fig.suptitle('Triangulate Run Summary', fontsize=14)
fig.tight_layout()
```

When either `nrows` or `ncols` is 1, `axes` is a 1D array:

```python
# Single row of 3 subplots
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
axes[0].plot(x, y)  # 1D indexing, not axes[0, 0]
axes[1].bar(cats, vals)
axes[2].hist(data)
```

Use `squeeze=False` if you want consistent 2D indexing regardless of grid shape:

```python
fig, axes = plt.subplots(1, 3, figsize=(15, 5), squeeze=False)
axes[0, 0].plot(x, y)  # always 2D, even with one row
```

### Shared Axes

When panels show the same variable on x or y, share that axis so scales match and
redundant labels are removed:

```python
fig, axes = plt.subplots(1, 3, figsize=(15, 4), sharey=True)

for ax_i, model in zip(axes, ['Claude', 'GPT-4o', 'Gemini']):
  ax_i.hist(data[model], bins=20, color='steelblue', edgecolor='black')
  ax_i.set_title(model)
  ax_i.set_xlabel('Match Confidence')

axes[0].set_ylabel('Frequency')  # only leftmost needs y-label
fig.suptitle('Match Confidence Distribution by Model', fontsize=14)
fig.tight_layout()
```

### Layout and Spacing

`fig.tight_layout()` adjusts spacing so labels do not overlap. Call it after all
plotting is done. When using `fig.suptitle()`, you may need to adjust the top margin:

```python
fig.suptitle('Overall Title', fontsize=16)
fig.tight_layout()
fig.subplots_adjust(top=0.92)  # make room for suptitle
```

### Project Example: Triangulate Dashboard

A complete multi-panel figure using triangulate metrics data:

```python
import matplotlib.pyplot as plt
import numpy as np

# Data from a triangulate metrics export
models = ['Claude Opus', 'GPT-4o', 'Gemini Pro']
finding_counts = [14, 11, 9]
unique_counts = [5, 3, 2]
shared_counts = [9, 8, 7]

severity_labels = ['critical', 'high', 'medium', 'low']
severity_data = {
  'Claude Opus': [1, 5, 6, 2],
  'GPT-4o':      [0, 4, 5, 2],
  'Gemini Pro':  [0, 3, 4, 2],
}

marginal_positions = [1, 2, 3]
marginal_new = [14.0, 5.3, 2.7]  # mean new unique per position

confidences = np.random.beta(5, 2, size=50)

fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# Panel 1: Finding count per model
axes[0, 0].bar(models, finding_counts, color='steelblue', edgecolor='black')
axes[0, 0].set_ylabel('Total Findings')
axes[0, 0].set_title('Findings by Model')

# Panel 2: Severity distribution per model (grouped bar)
x = np.arange(len(severity_labels))
w = 0.25
for i, (model, counts) in enumerate(severity_data.items()):
  axes[0, 1].bar(x + i * w, counts, w, label=model)
axes[0, 1].set_xticks(x + w)
axes[0, 1].set_xticklabels(severity_labels)
axes[0, 1].set_ylabel('Count')
axes[0, 1].set_title('Severity Distribution')
axes[0, 1].legend(fontsize=8)

# Panel 3: Match confidence histogram
axes[1, 0].hist(confidences, bins=20, color='steelblue', edgecolor='black')
axes[1, 0].set_xlabel('Match Confidence')
axes[1, 0].set_ylabel('Frequency')
axes[1, 0].set_title('Confidence Distribution')

# Panel 4: Marginal value curve
axes[1, 1].plot(marginal_positions, marginal_new, marker='o', color='tab:red')
axes[1, 1].set_xlabel('Review Position')
axes[1, 1].set_ylabel('Mean New Unique Findings')
axes[1, 1].set_title('Marginal Value by Position')
axes[1, 1].set_xticks(marginal_positions)
axes[1, 1].set_xticklabels(['1st Model', '2nd Model', '3rd Model'])

fig.suptitle('Triangulate Run Summary', fontsize=14)
fig.tight_layout()
fig.subplots_adjust(top=0.92)
fig.savefig('triangulate_dashboard.png', dpi=150, bbox_inches='tight')
```

> **AGENTIC GROUNDING:** The multi-panel figure is the standard output format for a
> triangulate run review. Instead of opening four separate plots, the Operator sees one
> image with all four views. This is how you go from "here is a YAML file with 50 keys"
> to "here is what you need to know" in a single glance. The `fig.savefig()` at the end
> means this can be generated by a script and attached to a PR or pasted into a review.

---

## 4. Heatmaps

*Estimated time: 30 minutes*

A heatmap displays a 2D matrix as a colored grid. Each cell's color represents its
value. Heatmaps are the right choice for correlation matrices, convergence matrices,
confusion matrices, and any data that is naturally a table of numbers where you want
to see patterns in the values rather than read individual cells.

### matplotlib: `ax.imshow()`

The low-level approach. You supply a 2D array and matplotlib maps values to colors.

```python
import matplotlib.pyplot as plt
import numpy as np

# Convergence matrix: findings x models, value = match confidence
findings = ['F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'F-06']
models = ['Claude', 'GPT-4o', 'Gemini']

# 1.0 = found, 0.0 = not found, intermediate = partial match
matrix = np.array([
  [1.0, 0.92, 0.88],   # F-01: all three found it
  [1.0, 0.85, 0.0],    # F-02: two found it
  [0.0, 1.0, 0.91],    # F-03: two found it
  [1.0, 0.0, 0.0],     # F-04: only Claude
  [0.78, 0.82, 0.79],  # F-05: all three, moderate confidence
  [0.0, 0.0, 1.0],     # F-06: only Gemini
])

fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(matrix, cmap='YlOrRd', aspect='auto', vmin=0, vmax=1)

ax.set_xticks(range(len(models)))
ax.set_xticklabels(models)
ax.set_yticks(range(len(findings)))
ax.set_yticklabels(findings)
ax.set_title('Finding Convergence Matrix')

# Add text annotations in each cell
for i in range(len(findings)):
  for j in range(len(models)):
    val = matrix[i, j]
    color = 'white' if val > 0.5 else 'black'
    ax.text(j, i, f'{val:.2f}', ha='center', va='center', color=color, fontsize=10)

plt.colorbar(im, ax=ax, label='Match Confidence')
fig.tight_layout()
```

The annotation loop is necessary with `imshow()` because it does not add cell labels
automatically. For annotated heatmaps, seaborn's `sns.heatmap()` is simpler (see
Section 8).

### Colormaps

Colormap choice depends on what the data represents:

| Data type                      | Colormap       | Why                                        |
|--------------------------------|----------------|--------------------------------------------|
| Sequential (0 to max)          | `'viridis'`    | Perceptually uniform, colorblind-safe      |
| Sequential (intensity/heat)    | `'YlOrRd'`    | Yellow to red, intuitive "heat" metaphor   |
| Diverging (centered at 0)      | `'coolwarm'`   | Two colors diverge from a neutral center   |
| Diverging (correlation, -1 to 1) | `'RdBu'`    | Red-white-blue, strong contrast            |

**The rule:** sequential data gets a sequential colormap. Diverging data (where there
is a meaningful center point) gets a diverging colormap with `vmin` and `vmax` set
symmetrically around the center. Never use `'jet'` or `'rainbow'` - they create false
visual boundaries and are not accessible to colorblind viewers.

### Correlation Matrix Heatmap

```python
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Simulated correlation matrix
columns = ['finding_count', 'convergence_rate', 'match_confidence',
           'unique_ratio', 'severity_mean']
np.random.seed(42)
data = np.random.randn(100, 5)
data[:, 1] = data[:, 0] * 0.7 + np.random.randn(100) * 0.5  # correlated
df = pd.DataFrame(data, columns=columns)
corr = df.corr()

fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(corr.values, cmap='coolwarm', vmin=-1, vmax=1)

ax.set_xticks(range(len(columns)))
ax.set_xticklabels(columns, rotation=45, ha='right')
ax.set_yticks(range(len(columns)))
ax.set_yticklabels(columns)
ax.set_title('Metric Correlation Matrix')
plt.colorbar(im, ax=ax, label='Pearson Correlation')

fig.tight_layout()
```

> **AGENTIC GROUNDING:** The convergence matrix from `bin/triangulate` is a natural
> heatmap. Findings on one axis, models on the other, color intensity = match
> confidence. A single glance shows: which findings all models agree on (bright row),
> which only one model found (mostly dark row with one bright cell), and whether any
> model systematically disagrees with the others (a column that is darker than the
> rest). This is the kind of pattern that is invisible in YAML but obvious in a heatmap.

---

## 5. Annotations and Reference Lines

*Estimated time: 30 minutes*

A plot that shows data without context is incomplete. Reference lines mark thresholds,
baselines, and targets. Annotations call attention to specific data points. Together,
they turn a plot from "here is some data" into "here is what matters in this data."

### Horizontal and Vertical Reference Lines

`ax.axhline()` draws a horizontal line spanning the full width of the plot.
`ax.axvline()` draws a vertical line spanning the full height.

```python
import matplotlib.pyplot as plt

runs = list(range(1, 11))
convergence_rate = [0.35, 0.42, 0.48, 0.45, 0.55, 0.58, 0.62, 0.60, 0.68, 0.72]

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(runs, convergence_rate, marker='o', color='tab:blue', label='Convergence Rate')

# Target line: we want 60% convergence
ax.axhline(y=0.60, color='red', linestyle='--', linewidth=1, label='Target (60%)')

# Change point: process change at run 5
ax.axvline(x=5, color='gray', linestyle=':', linewidth=1, label='Process Change')

ax.set_xlabel('Run Number')
ax.set_ylabel('Convergence Rate')
ax.set_title('Convergence Rate with Target and Change Point')
ax.legend()
ax.set_ylim(0, 1.0)
fig.tight_layout()
```

Common uses for reference lines:
- Budget line on a cost chart
- SLO target on a latency chart
- Mean or median as a baseline
- Date of a process change, prompt update, or model switch

### Point Annotations

`ax.annotate()` draws a text label with an optional arrow pointing to a specific data
point:

```python
# Find the peak convergence rate
peak_idx = convergence_rate.index(max(convergence_rate))
peak_x = runs[peak_idx]
peak_y = convergence_rate[peak_idx]

ax.annotate(
  f'Peak: {peak_y:.2f}',
  xy=(peak_x, peak_y),              # arrow points here
  xytext=(peak_x - 2, peak_y + 0.1),  # text placed here
  arrowprops=dict(arrowstyle='->', color='black'),
  fontsize=10,
)
```

- `xy` = the data point the arrow points to
- `xytext` = where the label text is placed
- `arrowprops` = dict controlling arrow style

### Free Text

`ax.text()` places text at a specific coordinate without an arrow:

```python
ax.text(7, 0.30, 'Below target zone', fontsize=9, color='red',
        ha='center', va='center', style='italic')
```

Use `ha` (horizontal alignment) and `va` (vertical alignment) to control positioning
relative to the coordinate. Options: `'left'`, `'center'`, `'right'` for `ha`;
`'top'`, `'center'`, `'bottom'` for `va`.

> **AGENTIC GROUNDING:** A cost chart without a budget line is just a squiggle. A
> latency chart without an SLO target is just a trend. Reference lines turn data
> visualization into decision support: "Are we above or below the line?" is a yes/no
> question that a human can answer in under a second. Annotations mark the specific
> points that triggered a decision: "This is where we switched models," "This spike
> caused the investigation." Without them, the Operator has to cross-reference the
> chart against the events log to understand what they are looking at.

---

## 6. Saving and Exporting

*Estimated time: 20 minutes*

Interactive `plt.show()` is for exploration. For reports, documentation, and
dashboards, you save figures to files.

### The savefig Call

```python
fig.savefig('output/convergence_chart.png', dpi=150, bbox_inches='tight',
            facecolor='white')
```

| Parameter      | Purpose                               | Recommended value          |
|----------------|---------------------------------------|----------------------------|
| `dpi`          | Resolution (dots per inch)            | 150 for screen, 300 for print |
| `bbox_inches`  | Crop whitespace around the figure     | Always `'tight'`           |
| `facecolor`    | Background color                      | `'white'` (some backends default to transparent) |

### Format by Extension

The file extension determines the output format:

| Extension | Type   | Best for                              |
|-----------|--------|---------------------------------------|
| `.png`    | Raster | Web, slides, dashboards, PR comments  |
| `.svg`    | Vector | Documentation, web (scales perfectly) |
| `.pdf`    | Vector | Papers, printed reports               |

```python
# Same figure, three formats
fig.savefig('chart.png', dpi=150, bbox_inches='tight', facecolor='white')
fig.savefig('chart.svg', bbox_inches='tight', facecolor='white')
fig.savefig('chart.pdf', bbox_inches='tight', facecolor='white')
```

### Order of Operations

Call `savefig()` before `plt.show()`. In some backends, `show()` clears the figure,
so saving after showing produces a blank image.

```python
# Correct order
fig.tight_layout()
fig.savefig('output.png', dpi=150, bbox_inches='tight')
plt.show()  # if running interactively
```

### Closing Figures

When generating many figures in a loop (e.g., one chart per triangulate run),
unclosed figures consume memory. Close them explicitly:

```python
for run_id in run_ids:
  fig, ax = plt.subplots(figsize=(8, 5))
  ax.plot(data[run_id])
  ax.set_title(f'Run {run_id}')
  fig.savefig(f'output/run_{run_id}.png', dpi=150, bbox_inches='tight')
  plt.close(fig)  # free memory
```

> **AGENTIC GROUNDING:** Agent-generated visualization scripts almost never include
> `fig.savefig()`. They display with `plt.show()`, which is useless in a headless
> pipeline. If you dispatch a polecat to generate charts from triangulate data, the
> script must save to files, not display interactively. Always specify `dpi`,
> `bbox_inches='tight'`, and `facecolor='white'` to get consistent, complete output.

---

## 7. Common Mistakes

*Estimated time: 30 minutes*

These are the visualization anti-patterns. They make charts misleading, unreadable,
or both. Each one is common enough that you will encounter it in agent-generated code
and in tutorials.

### Mistake 1: Truncated Y-Axis Exaggerating Differences

Starting the y-axis at a non-zero value makes small differences look enormous. A bar
going from 98 to 100 looks like a 100% increase when the axis starts at 97.

**Bad example - truncated axis:**

```python
import matplotlib.pyplot as plt

models = ['Claude', 'GPT-4o', 'Gemini']
accuracy = [96.2, 95.8, 95.5]

# BAD: y-axis starts near 95, exaggerating a 0.7% difference
fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(models, accuracy, color='steelblue', edgecolor='black')
ax.set_ylim(95, 97)  # this is the problem
ax.set_ylabel('Accuracy (%)')
ax.set_title('Model Accuracy (Misleading)')
fig.tight_layout()
```

The 0.7% difference between Claude and Gemini looks like Claude is twice as good.

**Fixed example - full axis:**

```python
import matplotlib.pyplot as plt

models = ['Claude', 'GPT-4o', 'Gemini']
accuracy = [96.2, 95.8, 95.5]

# GOOD: y-axis starts at 0, showing the true proportion
fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(models, accuracy, color='steelblue', edgecolor='black')
ax.set_ylim(0, 100)  # full range shows the difference is tiny
ax.set_ylabel('Accuracy (%)')
ax.set_title('Model Accuracy (Honest)')
fig.tight_layout()
```

Now the bars are nearly identical, which is the truth. A 0.7% difference on a 96%
baseline is operationally insignificant for most decisions.

**Rule:** Default to starting bar charts at 0. Line charts are more forgiving because
the focus is on trend shape, but even then, consider whether the axis range distorts
the story.

### Mistake 2: Rainbow Colormaps on Sequential Data

The `'jet'` and `'rainbow'` colormaps create artificial visual boundaries between
colors that do not correspond to boundaries in the data. Yellow-green-cyan transitions
look like category boundaries when the underlying data is continuous. They are also
inaccessible to colorblind viewers - about 8% of males.

**Bad example - rainbow colormap:**

```python
import matplotlib.pyplot as plt
import numpy as np

np.random.seed(42)
matrix = np.random.rand(6, 6)

# BAD: rainbow creates false boundaries, not colorblind-safe
fig, ax = plt.subplots(figsize=(7, 6))
im = ax.imshow(matrix, cmap='jet')  # jet is the classic offender
ax.set_title('Heatmap with Rainbow (Misleading)')
plt.colorbar(im, ax=ax)
fig.tight_layout()
```

**Fixed example - perceptually uniform colormap:**

```python
import matplotlib.pyplot as plt
import numpy as np

np.random.seed(42)
matrix = np.random.rand(6, 6)

# GOOD: viridis is perceptually uniform and colorblind-safe
fig, ax = plt.subplots(figsize=(7, 6))
im = ax.imshow(matrix, cmap='viridis')
ax.set_title('Heatmap with Viridis (Honest)')
plt.colorbar(im, ax=ax)
fig.tight_layout()
```

With `'viridis'`, equal steps in data produce equal steps in perceived brightness.
There are no false boundaries. The colormap degrades gracefully in grayscale and is
readable by colorblind viewers.

### Mistake 3: Pie Charts for More Than 3 Categories

Humans are poor at comparing angles and areas. With 4 or more slices, it becomes
impossible to judge relative sizes. Is the 18% slice larger than the 16% slice?
In a pie chart, you cannot tell. In a bar chart, it is obvious.

**Fix:** Replace pie charts with horizontal bar charts (`ax.barh()`). Sorted bars are
trivially easy to read for any number of categories.

### Mistake 4: 3D Charts That Obscure

3D bar charts, 3D pie charts, and most 3D scatter plots obscure data through
perspective distortion and occlusion. Values behind other values are hidden.

**Fix:** Use 2D alternatives. Encode the third dimension as color or size in a 2D
scatter plot. Use facets (subplots) to show a third variable. The information density
is higher and nothing is hidden.

### Mistake 5: Missing Axis Labels

A chart without axis labels requires the viewer to guess what they are looking at.
It is incomplete communication, equivalent to a function that returns a value with no
documentation of what the value represents.

**Fix:** Every chart gets `ax.set_xlabel()`, `ax.set_ylabel()`, and `ax.set_title()`.
Include units in parentheses: `'Response Time (ms)'`, `'Cost (USD)'`, `'Finding Count'`.

### Mistake 6: Missing tight_layout

Labels and titles get clipped when matplotlib's default spacing is too tight for long
text. Rotated tick labels are especially prone to being cut off.

**Fix:** Call `fig.tight_layout()` after all plotting is done, or use
`fig.savefig(..., bbox_inches='tight')`. Both solve the clipping problem.

> **AGENTIC GROUNDING:** Agents reproduce whatever chart patterns are most common in
> their training data. This includes rainbow colormaps, truncated axes, missing labels,
> and 3D charts - because tutorials and Stack Overflow answers are full of them. When
> reviewing agent-generated visualization code, use this section as a checklist: axis
> starts at 0 for bar charts? Colormap is perceptually uniform? Labels present? No 3D?
> No pie charts with more than 3 slices? If any check fails, send it back.

---

## 8. Seaborn for Statistical Plots

*Estimated time: 40 minutes*

Seaborn builds on matplotlib. It provides higher-level functions for statistical
visualizations - plots that would take 20-30 lines of raw matplotlib in 3-5 lines
of seaborn. The critical integration detail: every seaborn plot function that draws on
a single axes accepts an `ax=` parameter, so seaborn plots embed naturally into
matplotlib figures.

The pattern: matplotlib creates the figure and axes, seaborn renders into them, all
labeling and formatting uses matplotlib's OOP API.

```python
import matplotlib.pyplot as plt
import seaborn as sns

fig, ax = plt.subplots(figsize=(8, 5))
sns.boxplot(data=df, x='model', y='finding_count', ax=ax)  # seaborn draws
ax.set_title('Finding Count by Model')                       # matplotlib labels
ax.set_ylabel('Findings')
fig.tight_layout()
```

### Box Plot

Shows the distribution of a continuous variable across categories. Displays the median
(center line), interquartile range (box), whiskers (1.5x IQR), and outliers
(individual points).

```python
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Simulated: severity scores by model from multiple triangulate runs
np.random.seed(42)
data = []
for model in ['Claude', 'GPT-4o', 'Gemini']:
  n = 30
  scores = np.random.normal(loc={'Claude': 2.5, 'GPT-4o': 2.2, 'Gemini': 2.0}[model],
                            scale=0.8, size=n).clip(1, 4)
  for s in scores:
    data.append({'model': model, 'severity_score': s})
df = pd.DataFrame(data)

fig, ax = plt.subplots(figsize=(8, 5))
sns.boxplot(data=df, x='model', y='severity_score', palette='Set2', ax=ax)
ax.set_xlabel('Model')
ax.set_ylabel('Mean Severity Score (1=low, 4=critical)')
ax.set_title('Severity Score Distribution by Model')
fig.tight_layout()
```

Use a box plot when you need to compare distributions and care about median, spread,
and outliers. When exact distribution shape matters (bimodality, skew), use a violin
plot instead.

### Violin Plot

Like a box plot but shows the full density shape of the distribution. Reveals
bimodality and other features that box plots hide.

```python
fig, ax = plt.subplots(figsize=(8, 5))
sns.violinplot(data=df, x='model', y='severity_score', inner='quart',
               palette='Set2', ax=ax)
ax.set_xlabel('Model')
ax.set_ylabel('Severity Score')
ax.set_title('Severity Distribution Shape by Model')
fig.tight_layout()
```

The `inner='quart'` parameter draws quartile lines inside the violin, combining the
density view with the statistical summary of a box plot.

### Heatmap

`sns.heatmap()` is the recommended approach for annotated heatmaps. It handles tick
labels from DataFrame index/columns automatically and adds cell annotations with a
single parameter.

```python
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Convergence matrix as a DataFrame
findings = ['F-01', 'F-02', 'F-03', 'F-04', 'F-05']
models = ['Claude', 'GPT-4o', 'Gemini']
matrix = pd.DataFrame(
  [[1.0, 0.92, 0.88],
   [1.0, 0.85, 0.0],
   [0.0, 1.0, 0.91],
   [1.0, 0.0, 0.0],
   [0.78, 0.82, 0.79]],
  index=findings, columns=models
)

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(matrix, annot=True, fmt='.2f', cmap='YlOrRd',
            vmin=0, vmax=1, linewidths=0.5, ax=ax)
ax.set_title('Finding Convergence Matrix')
ax.set_ylabel('Finding')
ax.set_xlabel('Model')
fig.tight_layout()
```

Compare this to the `ax.imshow()` version in Section 4 - seaborn handles the
annotation loop, tick labels from the DataFrame, and grid lines automatically. Use
`sns.heatmap()` when the data is in a DataFrame. Use `ax.imshow()` when you need
lower-level control or are working with raw numpy arrays.

For correlation matrices, set `center=0` to properly handle the diverging colormap:

```python
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(df.corr(), annot=True, fmt='.2f', cmap='coolwarm',
            vmin=-1, vmax=1, center=0, linewidths=0.5, ax=ax)
ax.set_title('Correlation Matrix')
fig.tight_layout()
```

### Pair Plot

A matrix of scatter plots for every pair of numeric columns, with histograms or KDEs
on the diagonal. Use for exploratory analysis when you want to see all pairwise
relationships at once.

```python
import seaborn as sns
import pandas as pd
import numpy as np

# Simulated metrics from multiple triangulate runs
np.random.seed(42)
metrics_df = pd.DataFrame({
  'finding_count': np.random.poisson(12, size=30),
  'convergence_rate': np.random.beta(5, 3, size=30),
  'mean_confidence': np.random.beta(4, 2, size=30),
  'unique_ratio': np.random.beta(2, 5, size=30),
})

g = sns.pairplot(metrics_df, diag_kind='hist', corner=True)
g.figure.suptitle('Triangulate Metric Relationships', y=1.02)
```

**Important:** `pairplot()` creates its own figure. It does not accept an `ax=`
parameter. Access the underlying figure via `g.figure`. Use `corner=True` to show only
the lower triangle (the upper triangle would be a mirror).

Limit pair plots to 5-6 variables. Beyond that, the individual panels become too small
to read. For presentation, pick the interesting pairs and make full-size scatter plots.

### Seaborn in Multi-Panel Figures

The integration pattern - matplotlib creates the layout, seaborn fills the panels:

```python
import matplotlib.pyplot as plt
import seaborn as sns

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Panel 1: box plot (seaborn)
sns.boxplot(data=df, x='model', y='finding_count', ax=axes[0])
axes[0].set_title('Finding Count Distribution')

# Panel 2: heatmap (seaborn)
sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='coolwarm', ax=axes[1])
axes[1].set_title('Metric Correlations')

# Panel 3: scatter (matplotlib)
axes[2].scatter(df['convergence_rate'], df['match_confidence'], alpha=0.7)
axes[2].set_xlabel('Convergence Rate')
axes[2].set_ylabel('Match Confidence')
axes[2].set_title('Rate vs Confidence')

fig.suptitle('Review Analytics Dashboard', fontsize=14)
fig.tight_layout()
fig.subplots_adjust(top=0.88)
```

The `ax=` parameter is what makes this work. Without it, seaborn would create its own
figure for each call, defeating the purpose of the multi-panel layout.

> **AGENTIC GROUNDING:** Seaborn saves significant code for statistical
> visualizations, but the `ax=` parameter discipline is what matters. An agent that
> calls `sns.boxplot(data=df, x='model', y='value')` without `ax=ax` creates a
> standalone figure that cannot be composed into a dashboard. When reviewing
> agent-generated seaborn code, check for `ax=` in every call. Its absence means the
> plot is not composable.

---

## Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Convergence Heatmap

**Estimated time: 20 minutes**

**Goal:** Plot the convergence matrix from a triangulate export as an annotated
heatmap.

Create a Python script that:

1. Defines the following convergence data (simulating output from `convergence.yaml`):

```python
import pandas as pd

findings = ['F-01: Missing auth check', 'F-02: Uncaught exception',
            'F-03: SQL injection risk', 'F-04: Stale config ref',
            'F-05: Shadow validation', 'F-06: Missing error log',
            'F-07: Hardcoded secret', 'F-08: Race condition']
models = ['Claude Opus', 'GPT-4o', 'Gemini Pro']

# 1.0 = found with high confidence, 0.0 = not found
matrix = pd.DataFrame([
  [0.95, 0.91, 0.88],
  [0.87, 0.0,  0.82],
  [0.0,  0.93, 0.90],
  [0.92, 0.0,  0.0],
  [0.88, 0.85, 0.83],
  [0.0,  0.78, 0.0],
  [0.96, 0.94, 0.91],
  [0.84, 0.0,  0.0],
], index=findings, columns=models)
```

2. Creates a heatmap using `sns.heatmap()` with:
   - Cell annotations showing confidence values
   - A sequential colormap appropriate for 0-to-1 data
   - Grid lines between cells
   - Descriptive title, axis labels

3. Saves the output to `convergence_heatmap.png`

**Verification:** The saved image should show 8 rows and 3 columns. Cells with 0.0
should be visibly different from cells near 1.0. You should be able to tell at a
glance which findings all models agree on (F-01, F-05, F-07) and which only one
model found (F-04, F-06, F-08).

---

## Challenge: Triangulate Dashboard

**Estimated time: 30 minutes**

**Goal:** Create a 2x2 multi-panel figure showing four views of a triangulate run.

Using the simulated data below, create a figure with:

1. **Top left:** Bar chart of finding count per model
2. **Top right:** Grouped bar chart of severity distribution per model
3. **Bottom left:** Histogram of match confidence scores
4. **Bottom right:** Line chart of marginal value (mean new unique findings by review
   position)

```python
import numpy as np

models = ['Claude Opus', 'GPT-4o', 'Gemini Pro']
finding_counts = [16, 12, 10]

severity_cats = ['critical', 'high', 'medium', 'low']
severity_by_model = {
  'Claude Opus': [2, 6, 5, 3],
  'GPT-4o':      [1, 4, 5, 2],
  'Gemini Pro':  [0, 3, 5, 2],
}

np.random.seed(42)
confidences = np.concatenate([
  np.random.beta(8, 2, size=20),   # high-confidence cluster
  np.random.beta(2, 5, size=10),   # low-confidence cluster
])

positions = [1, 2, 3]
mean_new_unique = [16.0, 5.7, 2.3]
```

Requirements:
- Use `fig, axes = plt.subplots(2, 2, figsize=(12, 8))`
- Every panel has a title, axis labels, and proper formatting
- The figure has an overall `suptitle`
- Save to `triangulate_dashboard.png` at 150 dpi

**Verification:** The saved image should show four distinct panels. The bar chart
shows Claude with the most findings. The grouped bars show severity breakdown. The
histogram shows a bimodal distribution (two clusters of confidence). The line chart
shows diminishing marginal value.

<details>
<summary>Hints</summary>

For the grouped bar chart, use `np.arange()` for x positions and offset each model's
bars by the bar width:

```python
x = np.arange(len(severity_cats))
w = 0.25
for i, (model, counts) in enumerate(severity_by_model.items()):
  axes[0, 1].bar(x + i * w, counts, w, label=model)
axes[0, 1].set_xticks(x + w)
axes[0, 1].set_xticklabels(severity_cats)
```

</details>

---

## Challenge: Annotated Time Series

**Estimated time: 20 minutes**

**Goal:** Plot catch-log entries per week with a moving average overlay and
annotations.

Create a script that:

1. Simulates 12 weeks of catch-log data:

```python
import pandas as pd
import numpy as np

np.random.seed(42)
weeks = pd.date_range('2026-01-05', periods=12, freq='W')
catches = [3, 5, 4, 0, 6, 7, 5, 0, 8, 9, 7, 10]
```

2. Plots the weekly catch count as a line chart with markers
3. Overlays a 4-week simple moving average (use list comprehension or numpy)
4. Adds a horizontal reference line at the mean catch rate
5. Annotates weeks with zero catches using `ax.annotate()` with arrows pointing to
   those data points
6. Includes proper axis labels, title, and legend
7. Saves to `catch_rate_timeseries.png`

**Verification:** The chart should show 12 data points connected by a line, a smoother
4-week moving average line (starting at week 4), a horizontal mean line, and two
annotations pointing to the zero-catch weeks (week 4 and week 8). The legend should
distinguish all three series.

---

## Challenge: Model Comparison Dashboard

**Estimated time: 20 minutes**

**Goal:** Build a single figure with 4 subplots comparing two darkcat alley runs
(before and after a prompt change).

Using the simulated data below, create a figure with:

1. **Panel 1:** Paired bar chart - finding count before vs after, by model
2. **Panel 2:** Box plot of match confidence, before vs after
3. **Panel 3:** Heatmap of convergence rate change (after minus before) by
   severity level and model
4. **Panel 4:** Scatter plot of before vs after finding counts per model, with a
   diagonal reference line (y=x, meaning "no change")

```python
import pandas as pd
import numpy as np

models = ['Claude', 'GPT-4o', 'Gemini']
before_counts = [12, 9, 7]
after_counts = [15, 13, 11]

np.random.seed(42)
before_conf = np.random.beta(4, 3, size=40)
after_conf = np.random.beta(6, 2, size=40)

severities = ['critical', 'high', 'medium', 'low']
# Change in convergence rate by severity and model (after - before)
rate_change = pd.DataFrame(
  [[0.05, 0.10, 0.08],
   [0.12, 0.15, 0.09],
   [0.03, 0.07, 0.11],
   [-0.02, 0.01, 0.04]],
  index=severities, columns=models
)
```

Requirements:
- Use seaborn for the box plot and heatmap (with `ax=` parameter)
- Use matplotlib for the bar chart and scatter plot
- Include a diagonal `y=x` reference line on the scatter plot
- Use a diverging colormap for the rate change heatmap (centered at 0)
- Save to `model_comparison.png`

**Verification:** Panel 1 shows all three models improved. Panel 2 shows the "after"
distribution shifted right (higher confidence). Panel 3 shows mostly positive changes
(warm colors) with one negative cell (cool color) for critical/Claude. Panel 4 shows
all three points above the y=x line (meaning "after" > "before" for all models).

<details>
<summary>Hints</summary>

For the diagonal reference line on the scatter plot:

```python
lim = max(max(before_counts), max(after_counts)) + 2
ax.plot([0, lim], [0, lim], 'k--', alpha=0.5, label='No change')
ax.set_xlim(0, lim)
ax.set_ylim(0, lim)
```

For the diverging heatmap centered at 0:

```python
max_abs = rate_change.abs().max().max()
sns.heatmap(rate_change, annot=True, fmt='.2f', cmap='RdBu_r',
            vmin=-max_abs, vmax=max_abs, center=0, ax=ax)
```

</details>

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What are the two matplotlib interfaces, and why does this step teach only the OOP
   API?

2. Given the question "Is convergence rate improving over runs?" - what chart type do
   you use and why?

3. What is wrong with starting a bar chart's y-axis at 95 instead of 0?

4. When creating a 2x2 subplot grid, what type is the `axes` variable and how do you
   index into it?

5. Why is `'viridis'` preferred over `'jet'` for sequential data?

6. What is the difference between `ax.axhline()` and `ax.annotate()`? When do you use
   each?

7. Why must `fig.savefig()` be called before `plt.show()`?

8. What does the `ax=` parameter do in seaborn functions, and what happens if you
   omit it?

9. When would you use `sns.heatmap()` instead of `ax.imshow()`?

10. What is the decision table question type for "How do severity distributions compare
    across three models?"

---

## Recommended Reading

- **Fundamentals of Data Visualization** - Claus O. Wilke (2019). The best reference
  on choosing chart types and avoiding common distortions. Chapters 2-5 cover the
  principles; chapters 17-19 cover common pitfalls. Available free online at
  clauswilke.com/dataviz/.

- **matplotlib documentation** - the OOP API tutorial at
  matplotlib.org/stable/tutorials/introductory/lifecycle.html covers the figure/axes
  model. The gallery at matplotlib.org/stable/gallery/ is searchable by chart type.

- **Seaborn documentation** - seaborn.pydata.org/tutorial.html. The "Overview of
  seaborn plotting functions" page explains the function-based vs objects API and when
  to use each.

- **Edward Tufte, The Visual Display of Quantitative Information** (2nd edition, 2001).
  The foundational text on data visualization integrity. The concept of "data-ink
  ratio" (maximize the ink used to display data, minimize everything else) is the
  theoretical basis for avoiding 3D charts, excessive gridlines, and decorative
  elements.

---

## What to Read Next

**Step 7: Log Analysis Patterns** - agents produce logs: API call records, execution
traces, error messages, tool call sequences. Step 7 covers parsing these logs into
structured data (regex extraction, JSONL parsing, session reconstruction), computing
operational metrics (error rates, latency percentiles), and the transition from
grep+awk pipelines to SQL-based log analysis in DuckDB. The visualization techniques
from this step apply directly: once you have parsed log data into a DataFrame, you
plot error rate trends as line charts, latency distributions as histograms, and
per-session metrics as box plots. Step 6 gives you the plotting tools; Step 7 gives
you the data to plot.

