+++
title = "Redundant Antithesis"
id = "redundant-antithesis"
type = "tells"
aliases = ["/slopodar/redundant-antithesis/"]
domain = "prose-style"
detected = "2026-02-27"
confidence = "strong"
trigger = "caught in the wild: not theorised in advance"
description = "Negative-positive antithesis where the negation adds zero information. \"Caught in the wild\" already implies \"not theorised.\" The negation is dead weight. The classical form (\"not A, but B\") is a deliberate rhetorical choice; the LLM form is an RLHF-trained reflex."
detect = "Search for \"not X, but Y\" or \"not just X\" constructions. Ask: does Y already imply not-X? If yes, the negation is redundant. Also: \"rather than,\" \"instead of,\" \"as opposed to\" where the contrast is already implied."
instead = "Just say the positive. \"Entries are added when caught in the wild.\" If the contrast genuinely adds meaning, keep it. If the reader already knows the negated term, cut it."
severity = "high"
refs = ["SD-209 (tells.yaml header comment)", "Sloptics page: 'Nothing was theorised in advance.'", "Sloptics page: 'The mapping is structural, not metaphorical.': structural already implies not metaphorical", "Plank-1 v2 catch: 'Not a research position. Not a policy role.': Operator cut both 2026-03-05"]
+++
