+++
title = "Agent-native development: the IDE is a human perception layer"
date = "2026-03-23"
description = "6 development categories. IDEs, version control, databases, API testing, CI/CD, containers. All 6 fully reducible. The most sophisticated IDE is a text editor + compiler + language server."
tags = ["agent-native", "development", "ide", "cli"]
draft = true
+++

{{< draft-notice >}}

## All 6 fully reducible

IDEs, version control, databases, API testing, CI/CD, containers. None of this should surprise anyone - developers built these tools for themselves, and they tend to prefer CLIs. This was the most boring section to assess because the answer was always "yes, obviously."

## The IDE is a perception layer

An IDE does five things: edit text, highlight syntax, show errors inline, provide hover documentation, and manage project files. Four of those five are visual affordances for human cognition. The underlying data sources are the language server (LSP), the compiler, and the filesystem.

The agent accesses the language server directly. `typescript-language-server` provides diagnostics, completions, hover info, and go-to-definition through JSON-RPC. The compiler provides error messages as structured output. The filesystem is the filesystem.

Syntax highlighting exists because humans read code visually and need colour to distinguish identifiers from keywords. The agent parses the AST. Inline error squiggles exist because humans need spatial cues to locate problems. The agent reads the diagnostic line number.

VS Code is excellent software, and I use it daily. But the agent just needs the language server and the compiler. It doesn't even need an editor.

## Git was always CLI

Git is the canonical example. It was designed as a CLI tool. GitHub Desktop, GitKraken, the VS Code git panel - these are all GUIs over `git`. The merge conflict visualisation in an IDE is helpful for humans who need to see both versions side by side. The agent reads the conflict markers directly.

`git log`, `git diff`, `git blame`, `git bisect` - every operation is a command. The GitHub API and `gh` CLI extend this to pull requests, issues, and actions.

## Docker Desktop is a wrapper

Docker Desktop provides a GUI for container management on macOS and Windows. On Linux, Docker has always been CLI-only by default. `docker build`, `docker run`, `docker compose` - the commands are the interface. Docker Desktop adds a dashboard showing running containers, resource usage, and image layers. All of this data is available from `docker ps`, `docker stats`, and `docker inspect`.

## Databases and API testing

Database GUIs (pgAdmin, DBeaver, DataGrip) provide query editors with autocomplete, result set viewers, and schema browsers. The agent runs `psql` or connects via a database driver. The query is a string. The result is a table.

Postman provides a GUI for constructing HTTP requests. `curl` does the same thing in one line. `httpie` does it more readably. The Postman collection is a JSON file.

## CI/CD

GitHub Actions, GitLab CI, Jenkins - all configured via YAML or Groovy files, triggered by git events, monitored via API. The CI dashboard is a visualisation of pipeline state. `gh run list`, `gh run view`, `gh run watch` - the CLI covers it.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 8-13 (Development section)
