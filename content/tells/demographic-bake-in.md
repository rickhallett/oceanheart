+++
title = "Demographic Bake-In"
id = "demographic-bake-in"
type = "tells"
aliases = ["/slopodar/demographic-bake-in/"]
domain = "analytical-measurement"
detected = "2026-03-01"
confidence = "strong"
trigger = "\"Human baseline: 19 pages\": all male tech essayists, all English, all 2000–2023."
description = "The training data defines what \"normal\" looks like, and the analysis inherits that definition without declaring it. Every feature that discriminates \"human\" from \"AI\" is actually discriminating \"this demographic in this genre in this era\" from \"AI.\" The demographic is invisible because it is the default."
detect = "For any baseline or training set: can you state the demographic in one sentence? (\"19 English-language tech essays by 11 male authors, 2000-2023.\") If you can't, the demographic is unstated. If you can and it's narrow, the bake-in is operating."
instead = "Declare the demographic. Let the reader decide how far to generalise."
severity = "high"
refs = ["AnotherPair calibration v3 session 2026-03-01", "Layer 7 in the bias stack"]
+++
