+++
title = "Magnitude Blindness"
id = "magnitude-blindness"
type = "tells"
aliases = ["/slopodar/magnitude-blindness/"]
domain = "governance-process"
detected = "2026-03-02"
confidence = "medium"
trigger = "A 73-file public disclosure and a 3-line copy fix went through exactly the same review process."
description = "The model doesn't spontaneously scale its verification effort to the size of the change. A 3-file fix and a 73-file disclosure both get the same PR template, the same gate, the same level of scrutiny. It treats all changes as equivalent in weight regardless of what could go wrong."
detect = "Before reviewing, check the PR size. If it touches more than 10 files or spans more than 2 domains, ask whether the verification effort is proportional to the blast radius."
instead = "State the file count, domain span, and blast radius up front, then scale the review accordingly."
severity = "high"
refs = ["SD-133, SD-136 (73-file disclosure without proportional pause)", "SD-182 (batching amplifies probabilistic error)"]
+++
