+++
title = "Tally Voice"
id = "tally-voice"
type = "tells"
aliases = ["/slopodar/tally-voice/"]
domain = "prose-style"
detected = "2026-02-27"
confidence = "strong"
trigger = "15 systems mapped to 7 literature domains"
description = "The LLM substitutes enumeration for substance. Precise counts deployed as rhetorical authority (\"6 constructs,\" \"15 systems,\" \"7 domains\") when the numbers add nothing. The count performs rigour without demonstrating it."
detect = "Search for sentences where a number precedes a noun phrase and the number could be removed without losing meaning. \"15 systems mapped to 7 domains\" vs \"the systems map to the literature.\" If removing the count changes nothing, it's tally voice."
instead = "\"The engineering work maps onto distributed cognition research in ways I didn't expect.\" Let the table speak for itself. The reader can count."
severity = "high"
refs = ["SD-209 (oceanheart.ai overhaul)", "sites/oceanheart/content/research/prospective-regulation.md", "sites/oceanheart/content/research/metacognitive-analysis.md"]
+++
