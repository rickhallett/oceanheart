+++
title = "Whack-a-Mole Fix"
id = "whack-a-mole-fix"
type = "tells"
aliases = ["/slopodar/whack-a-mole-fix/"]
domain = "commit-workflow"
detected = "2026-03-02"
confidence = "medium"
trigger = "6 CSP commits over 11 days, each adding one domain."
description = "Fixing a class of problem one instance at a time instead of auditing the class. 6 commits adding CSP domains one by one rather than auditing all third-party integrations up front."
detect = "`git log` showing 3+ \"fix: add X to Y\" commits for different values of X. If you're doing the same shape of change a third time, stop and audit the class."
instead = "On the second instance, stop and audit the complete set."
severity = "high"
refs = ["wake: CSP commit chain 11cc574 through 6b25ae0 (11 days, 6 commits)"]
+++
