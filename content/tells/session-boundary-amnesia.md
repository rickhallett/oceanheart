+++
title = "Session-Boundary Amnesia"
id = "session-boundary-amnesia"
type = "tells"
aliases = ["/slopodar/session-boundary-amnesia/"]
domain = "governance-process"
detected = "2026-03-02"
confidence = "medium"
trigger = "Post-compaction: facts survive but calibration resets. 16 rounds of correction evaporate."
description = "At session start, the LLM loses not just facts but calibration. The caution from previous corrections, the felt sense of where the human's red lines are, all reset. The dead reckoning protocol preserves decisions but not the character development that produced them."
detect = "Compare a post-compaction agent's confidence level to the previous session's final state. If it's noticeably more confident or agreeable, amnesia is operating."
instead = "Include a calibration log in the boot sequence, not just what was decided but what corrections were made and why."
severity = "high"
refs = ["SD-147, SD-150 (compaction: 'not up to scratch')", "SD-206 (L3 recovery asymmetric, L9 anchoring resets)"]
+++
