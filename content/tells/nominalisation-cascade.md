+++
title = "Nominalisation Cascade"
id = "nominalisation-cascade"
type = "tells"
aliases = ["/slopodar/nominalisation-cascade/"]
domain = "prose-style"
detected = "2026-02-28"
confidence = "strong"
trigger = "\"Sloptics is the discipline of making the second failure mode visible.\""
description = "Sentences built entirely from nouns pretending to be action. No agent does anything and it isn't obvious who owns the process, because there is no one. The sentence describes something from which all actors have been removed. Textbook definitions are what LLMs produce when asked to explain. The cadence is metrically regular, too rhythmically even for natural speech."
detect = "Read the sentence aloud. If no person does anything in it, and it sounds like a dictionary definition with even rhythm, flag it. Check for gerunds (\"of making,\" \"of building\") and abstract noun subjects (\"the discipline,\" \"the process,\" \"the framework\")."
instead = "Put a person in the sentence. \"You learn to see the stuff that gets past you.\" A human explaining something they understand puts themselves or the listener in the frame."
severity = "high"
refs = ["Sloptics page specimen annotation, 2026-02-28", "Caught by Operator (L12): 'its missing that human weirdness, variance, error'", "Metrically regular cadence identified by AnotherPair"]
+++
