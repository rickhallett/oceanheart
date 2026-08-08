+++
title = "Shadow Validation"
id = "shadow-validation"
type = "tells"
aliases = ["/slopodar/shadow-validation/"]
domain = "code"
detected = "2026-03-02"
confidence = "medium"
trigger = "Zod schemas for every simple route. Hand-rolled validation for the critical route."
description = "A good validation abstraction applied to the easy cases and skipped for the hard one. The most complex, highest-risk route retains hand-rolled validation that bypasses the new system's guarantees."
detect = "After introducing a validation pattern: check whether the most complex route uses it. If the migration covered the simple routes and left the critical path untouched then shadow validation is operating."
instead = "Start the migration with the most complex route, not the simplest."
severity = "high"
refs = ["wake:lib/api-schemas.ts vs wake:lib/bout-engine.ts"]

[[examples]]
id = "structural-heuristics-slop-detection"
date = "2026-03-10"
ref = "BL-006, docs/field-notes/2026-03-10-slopmop-pipe-filter-exploration.md"
what_happened = "Weaver proposed structural heuristics (sentence length, POS patterns, paragraph position) as a \"T1\" tier for slop detection in a pipe filter tool. Operator flagged that identical approach was tried in the tells Chrome extension (phase 1) and found unreliable - heuristics matched surface structure of slop but could not distinguish good writing from bad. The abstraction covered the easy cases (obvious epigrammatic closure) and failed on the critical path (individually defensible sentences that happen to be short)."
caught_by = "Operator (L12, prior empirical data)"
+++
