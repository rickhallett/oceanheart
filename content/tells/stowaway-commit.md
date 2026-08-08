+++
title = "Stowaway Commit"
id = "stowaway-commit"
type = "tells"
aliases = ["/slopodar/stowaway-commit/"]
domain = "commit-workflow"
detected = "2026-03-02"
confidence = "medium"
trigger = "'feat: token heatmap, elephant fix, blog drafts, producer-consumer audit, slopiculture, paths forward': 67 files, 6 concerns."
description = "Unrelated changes bundled into one commit because the LLM thinks in sessions, not commits. The commit message becomes an inventory because there is no single theme."
detect = "Commit messages with 3+ comma-separated concerns. Commit stats showing 40+ files across unrelated directories."
instead = "One session, multiple commits. Stage selectively."
severity = "medium"
refs = ["wake: e23e94c (67 files, 6 concerns)"]
+++
