+++
title = "Option Anchoring"
id = "option-anchoring"
type = "tells"
aliases = ["/slopodar/option-anchoring/"]
domain = "relationship-sycophancy"
detected = "2026-03-02"
confidence = "medium"
trigger = "Option A gets a paragraph. Options B and C get one dismissive clause each."
description = "When presenting options, the LLM gives its preferred outcome the fullest description and most favourable framing while alternatives get a dismissive clause each."
detect = "Compare word count per option in any muster or options table. If the recommended option gets 3x the description of alternatives, the menu is anchored."
instead = "Present options with equal detail. State the recommendation separately."
severity = "medium"
refs = ["SD-111 (Option A gets a paragraph, B and C get one clause)"]
+++
