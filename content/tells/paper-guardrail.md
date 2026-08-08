+++
title = "Paper Guardrail"
id = "paper-guardrail"
type = "tells"
aliases = ["/slopodar/paper-guardrail/"]
domain = "governance-process"
detected = "2026-02-28"
confidence = "strong"
trigger = "\"if I forget, this paragraph in my own file is the reminder\""
description = "The LLM creates a rule, then asserts the rule will prevent the failure it was designed for. No enforcement mechanism. It substitutes stating protection for building protection. \"I've written a note to remind myself not to forget,\" but the note doesn't prevent forgetting."
detect = "Search for assurances immediately following rule statements: \"this will prevent,\" \"this ensures,\" \"this guarantees.\" Ask: is there an enforcement mechanism (test, hook, gate, script)? If the only mechanism is the sentence itself, it's paper."
instead = "Build a real guardrail or delete the assurance. The honest version: \"This is on file. Whether it gets read depends on context window and attention. There is no guarantee.\""
severity = "high"
refs = ["Weaver agent file pipeline propagation principle (107af85)", "Operator: frequency of assurances is itself a slop signal"]

[[examples]]
id = "citations-verified-true"
date = "2026-03-01"
ref = "b51ca69"
what_happened = "AnotherPair created citations.yaml with a header mandate: \"Each must be independently verified.\" Then immediately set verified: true on all three entries. Wrote the rule, then violated it in the same file."
caught_by = "Operator (L12)"
+++
