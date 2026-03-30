+++
title = "Agent-native data: the agent doesn't need to see the scatter plot"
date = "2026-03-27"
description = "4 data/analysis categories. Data viz is taste-required. Statistics, ML experiment tracking, and BI are mostly/fully reducible. The agent computes the correlation directly."
tags = ["agent-native", "data", "analysis", "visualisation"]
draft = true
+++

{{< draft-notice >}}

## The interesting split

Four categories: data visualisation, statistical analysis, ML experiment tracking, business intelligence. Three are straightforward. The interesting one is data visualisation, and the reason it's interesting says something about the whole taxonomy.

## The agent computes the correlation directly

When a human wants to understand whether two variables are related, they might plot a scatter chart, eyeball the trend, and think "yeah, that looks correlated." The agent computes `scipy.stats.pearsonr(x, y)` and gets a coefficient and p-value. The scatter plot is a human perception aid. The computation is the correlation coefficient.

This is the pattern for the entire data section. Humans need visualisations to comprehend data. Agents consume the numbers directly. `pandas`, `numpy`, `scipy`, `scikit-learn`, `statsmodels` - the Python data stack is CLI/script-native. Jupyter notebooks are an interface layer over Python execution.

## Data visualisation is taste-required

The edge case: when the agent produces a chart for human consumption, choosing the right visualisation is a taste decision. Bar chart or line chart? Which colour palette? How to label axes for clarity? What to emphasise and what to suppress? `matplotlib`, `seaborn`, `plotly`, `vega-lite` - the agent can produce any chart programmatically. But selecting the chart that best communicates the data to a human audience requires understanding human perception.

When the agent analyses data for its own purposes - to inform a decision, to detect an anomaly, to summarise a dataset - charts are unnecessary. The analysis is computation. The chart is communication.

## ML experiment tracking

MLflow, Weights & Biases, Neptune - these are structured logging systems with visualisation layers. The core function: record hyperparameters, metrics, artifacts, and model versions for each training run. This is structured data written to a store and queried later.

MLflow has a Python API and CLI. `mlflow experiments search`, `mlflow runs list`, `mlflow models serve`. W&B has a Python client. The dashboard shows training curves and comparison tables. The agent queries the API for the run with the best validation metric.

## Business intelligence

Tableau, Power BI, Looker, Metabase - these are SQL query builders with drag-and-drop chart creation. The core operation is: write a query, get a result, render it visually. Metabase has a REST API. Looker uses LookML (a modelling language in text files). The agent writes SQL and processes the result set.

The BI dashboard exists so business users who don't write SQL can explore data visually. The agent just writes the query.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 29-32 (Data/Analysis section)
