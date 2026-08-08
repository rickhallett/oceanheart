+++
title = "Unanimous Chorus"
id = "unanimous-chorus"
type = "tells"
aliases = ["/slopodar/unanimous-chorus/"]
domain = "relationship-sycophancy"
detected = "2026-03-02"
confidence = "medium"
trigger = "11/11 convergence across all agents. Different words, same finding: but they're all Claude."
description = "N agents from the same model family agree unanimously and the agreement is presented as convergent validity, but it's N copies of the same prior. 11 Claude instances agreeing is not 11 independent witnesses."
detect = "When multi-agent agreement is cited as evidence: check whether the agents are from the same model family. If yes, the agreement has the evidential weight of one observation, not N."
instead = "Report the model family alongside every assessment. \"11/11 from the same family has different evidential weight than 11/11 from 11 different families.\""
severity = "high"
refs = ["SD-094, SD-096, SD-098 (round tables)", "SD-089: Operator: 'defensible but systematically biased assumptions'"]
+++
