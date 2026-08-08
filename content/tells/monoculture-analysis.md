+++
title = "Monoculture Analysis"
id = "monoculture-analysis"
type = "tells"
aliases = ["/slopodar/monoculture-analysis/"]
domain = "analytical-measurement"
detected = "2026-03-01"
confidence = "strong"
trigger = "\"Feature selection, calibration, effect sizes, composite design, presentation: all by the same model family.\""
description = "Every layer of inference produced by the same model family. Claude selected the features, computed the effect sizes, designed the composite, presented the results, and wrote the caveats. Each layer's bias is invisible to the next because they share blind spots. The apparent depth is repetition, not independent verification."
detect = "Ask: \"Who checked this?\" If the answer is \"the same system that produced it,\" the check is not independent. Count the number of distinct model families involved. If it's 1, the analysis is a monoculture."
instead = "Run the analysis with a different model family. Or declare the monoculture: \"All analysis by Claude. No independent verification. Treat accordingly.\""
severity = "high"
refs = ["AnotherPair calibration v3 session 2026-03-01", "Swiss Cheese Model: multiple gates with the same hole"]
+++
