+++
title = "Half-Life Clock Skew"
id = "half-life-clock-skew"
type = "tells"
aliases = ["/slopodar/half-life-clock-skew/"]
domain = "code"
detected = "2026-03-02"
confidence = "low"
trigger = "The TypeScript pre-check uses Date.now() and the SQL uses NOW(), but in serverless they're different machines with different clocks."
description = "A computation duplicated across trust boundaries (app server vs database) using implicitly different time sources. In serverless deployments these are different machines. When exponential decay is involved, a clock difference of seconds can flip the result."
detect = "Search for time-dependent logic that appears in both app code and SQL. If `Date.now()` and `NOW()` are both used in the same flow, check whether clock skew could produce different outcomes."
instead = "Let the database be the single clock authority."
severity = "medium"
refs = ["wake:lib/intro-pool.ts"]
+++
