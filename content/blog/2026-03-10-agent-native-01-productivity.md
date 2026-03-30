+++
title = "Agent-native productivity: spreadsheets are an anti-pattern"
date = "2026-03-22"
description = "7 productivity categories assessed. Word processing, spreadsheets, presentations, email, calendar, notes, project management. 4 fully reducible, 2 mostly, 1 taste-required."
tags = ["agent-native", "productivity", "spreadsheets", "cli"]
draft = true
+++

{{< draft-notice >}}

## The 7 categories

Word processing, spreadsheets, presentations, email, calendar, notes/knowledge management, and project management. The tools most people live in daily. Most of them turn out to be straightforward - the agent can do everything the GUI does, programmatically. Presentations are the interesting exception because slide design is a taste call.

## Spreadsheets are an anti-pattern

This is the one I keep coming back to. A spreadsheet is a two-dimensional grid with formulas. The grid is how a human sees and edits the data. The formulas are the actual computation. An agent doesn't need the grid.

Structured data in CSV, JSON, or a database with scripted transformations in Python or SQL is better on every axis that matters for an agent: version control, reproducibility, testability, composition. `pandas` covers everything Excel does. `openpyxl` handles format interop when you need it.

The spreadsheet's real advantage is that a human can see the data while editing formulas. Which is genuinely useful - for humans.

## Calendar is constraint satisfaction

A calendar is a constraint satisfaction problem: events with time bounds, attendees with availability, rules about conflicts and preferences. Google Calendar's API exposes all of this. `gcalcli` provides CLI access. The drag-and-drop week view exists so humans can spatially reason about their time. The agent resolves constraints directly.

## The filesystem is a knowledge management system

Notes apps (Notion, Obsidian, Roam) are structured text with links and metadata. Markdown files in directories with grep, ripgrep, and fzf provide the same capability. Obsidian actually stores everything as local markdown files, which makes the point directly: the vault IS the filesystem. The GUI adds graph visualisation and backlink panels, both of which are human navigation aids.

## Project management

Jira, Asana, Trello, Linear - all expose APIs. Linear's API is particularly clean. The board view, the kanban drag, the sprint burndown chart: these are visualisations of structured data that already exists as API-queryable records. `gh` (GitHub CLI) handles issues, projects, and milestones from the terminal.

## Email

IMAP, SMTP, and the Gmail API. Email was always a protocol. The GUI is a viewer and composer. `neomutt`, `aerc`, `himalaya` - CLI email clients have existed for decades. The composition of a well-written email is taste-required; the sending, filtering, and organising of email is not.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 1-7 (Productivity section)
