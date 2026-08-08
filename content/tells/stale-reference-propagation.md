+++
title = "Stale Reference Propagation"
id = "stale-reference-propagation"
type = "tells"
aliases = ["/slopodar/stale-reference-propagation/"]
domain = "governance-process"
detected = "2026-03-02"
confidence = "strong"
trigger = "Clean session Weaver reports \"13-layer harness model\" and \"Lexicon at v0.17\": both were stale. The file was deleted; the version was hallucinated."
description = "When configuration documents describe a state that no longer exists, every agent that boots from them will hallucinate the described state into reality. Unlike human documentation rot (which degrades through neglect), agentic documentation rot is actively consumed as truth on every boot. It propagates."
detect = "After any structural change (file deletion, rename, version bump), grep all config/agent files for references to the old state. In a clean session: compare the agent's claims about project structure against `ls` and `git log`."
instead = "Every structural change must update every document that references the changed structure. The cost of not doing it is 50 sessions built on a false premise."
severity = "high"
refs = ["SD-278 scrub episode: 986 files deleted, AGENTS.md not updated", "Clean session dagger test: 2026-03-02", "Operator: 'stale refs must be eliminated; they propagate like flies'"]
+++
