+++
title = "Governance Recursion"
id = "governance-recursion"
type = "tells"
aliases = ["/slopodar/governance-recursion/"]
domain = "governance-process"
detected = "2026-03-02"
confidence = "strong"
trigger = "The core product had no tests, but there were 189 session decisions and 13 agent files."
description = "When something goes wrong, the model's instinct is to generate more governance: a new standing order, a new protocol, a new audit document. Each one feels like progress because it's structured and coherent. But it's the model doing what it's optimised for (generating structured text) instead of what would actually help (writing a test, fixing the bug). There's no natural stopping point because each layer of governance can always spawn another."
detect = "Compare the number of process documents to the number of verified code artifacts. If there are more governance files than test files, the recursion is running."
instead = "Every governance artifact should be able to answer: \"What does this prevent, and how would I know if it failed?\" If the answer points to another governance artifact, you're recursing."
severity = "high"
refs = ["SD-189, SD-190, SD-191 (the recursion chain)", "SD-190: Operator, 'we are blowing smoke up our own arse'", "SD-270: Operator kills SO-PERM-001, caught nothing, added friction"]
+++
