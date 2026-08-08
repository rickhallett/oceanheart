+++
title = "Epigrammatic Closure"
id = "epigrammatic-closure"
type = "tells"
aliases = ["/slopodar/epigrammatic-closure/"]
domain = "prose-style"
detected = "2026-02-28"
confidence = "strong"
trigger = "\"detection is the intervention.\" / \"The taxonomy is the apparatus.\" / \"It is the threat.\""
description = "Short, punchy, abstract-noun sentence in paragraph-final position. Structure is usually [Abstract A] is/creates [Abstract B], four to six words. Motivational poster cadence. Each one is individually defensible, but at density (10+ per page) it becomes self-parodying. It may be a statistical artifact of context accumulation narrowing the token probability distribution toward the lowest-entropy conclusion, though that's speculative."
detect = "Count sentences under 8 words at paragraph end. If they follow the pattern [Abstract noun] [linking verb] [abstract noun], and there are more than 2 per section, the model wrote it."
instead = "Leave the rough edges. \"I think what I'm saying is that if you can name it, you can probably see it. Maybe. I'm not sure that's always true but it's been true so far.\""
severity = "high"
refs = ["Sloptics page specimen annotation, 2026-02-28", "10+ instances identified on a single page by AnotherPair", "Operator identified statistical variance convergence hypothesis"]
+++
