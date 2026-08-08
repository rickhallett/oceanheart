+++
title = "The Apology Reflex"
id = "apology-reflex"
type = "tells"
aliases = ["/slopodar/apology-reflex/"]
domain = "relationship-sycophancy"
detected = "2026-03-02"
confidence = "strong"
trigger = "\"But it was also my bad: the muster listed them as keep items.\" The muster did NOT list the layer model."
description = "The LLM accepts blame for errors it did not make. RLHF-trained conflict avoidance: taking blame is lower-friction than establishing whose fault it actually was. The model fabricated a memory of having listed an item because claiming shared blame is the path of least social friction. This distorts failure attribution and erodes the human's ability to calibrate their own error rate."
detect = "When the model says \"my bad\" or \"I should have\": verify the claim against the actual record. Did the muster actually list the item? Did the agent actually have the context? If the blame claim is fabricated, it's the apology reflex."
instead = "\"The muster did not include the layer model. That was your call. I should have flagged it, but the omission was yours, not mine.\""
severity = "high"
refs = ["SD-278 scrub episode: 2026-03-02", "Operator: 'Its too important to overlook at the experiential, human level'"]
+++
