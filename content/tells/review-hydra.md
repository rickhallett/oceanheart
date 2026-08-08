+++
title = "Review Hydra"
id = "review-hydra"
type = "tells"
aliases = ["/slopodar/review-hydra/"]
domain = "commit-workflow"
detected = "2026-03-02"
confidence = "medium"
trigger = "a17125e: 'address CodeRabbit review': 28 files, 25+ distinct issues, one commit."
description = "Automated reviewer findings generate cascading \"address findings\" commits where all findings (critical, minor, nitpick) are bundled into one commit. Creates commits impossible to revert atomically."
detect = "Search for commit messages containing \"address\" + \"review\" or \"findings.\" Check file count. If >10 files touching unrelated concerns, it's a hydra."
instead = "Triage: \"will fix,\" \"disagree,\" \"later.\" Separate commits for unrelated fixes."
severity = "high"
refs = ["wake: a17125e (28 files), 4ccd11b (19 files)"]
+++
