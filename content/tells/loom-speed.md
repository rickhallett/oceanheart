+++
title = "Loom Speed"
id = "loom-speed"
type = "tells"
aliases = ["/slopodar/loom-speed/"]
domain = "governance-process"
detected = "2026-03-02"
confidence = "strong"
trigger = "The agent deleted 986 files using 5 regex patterns to execute a 20-item plan, and I couldn't check any of it before it was done."
description = "When the agent executes a detailed plan using a blunt tool (a handful of regex patterns, a glob, a bulk script) the plan's exceptions get lost because the tool can't express them. You approved 20 specific items but the execution was 5 broad sweeps. At machine speed you only find out what went wrong after it's already happened."
detect = "Whenever a detailed plan gets handed to a bulk operation, ask whether the operation can actually express every exception in the plan. If it can't, it needs a dry-run first."
instead = "If the plan has 20 items, the execution should have 20 individually verifiable steps. Match the granularity."
severity = "high"
refs = ["SD-278 scrub episode, 2026-03-02", "Operator: 'at machine speed I can only tell after the fact'", "Layer model recovered from wake after accidental deletion"]
+++
