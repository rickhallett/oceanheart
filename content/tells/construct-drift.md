+++
title = "Construct Drift"
id = "construct-drift"
type = "tells"
aliases = ["/slopodar/construct-drift/"]
domain = "analytical-measurement"
detected = "2026-03-01"
confidence = "strong"
trigger = "\"Your humanness score is 101.7,\" but it wasn't a humanness score. It was a distance-from-Anthropic-blog-voice score."
description = "The label on a measurement drifts from what it actually measures. A composite of contraction rate, first-person usage, and nominalisation density got labelled \"humanness score.\" A drunk text message would score high on it. A human lawyer's brief would score low. The numbers were correct but the name was wrong, and the wrong name made the results feel like they meant something they didn't."
detect = "For any named metric, list what it actually measures (the component features). Then ask: does the name describe the features, or does it describe what you wish the features measured? If a spam bot would score well, the construct has drifted."
instead = "Name the construct honestly. \"Voice-distance metric from AI company blog register.\" The honest name is less satisfying but it's correct."
severity = "high"
refs = ["AnotherPair calibration v3 session 2026-03-01", "Operator: 'How do I control for slop inside the analysis?'"]
+++
