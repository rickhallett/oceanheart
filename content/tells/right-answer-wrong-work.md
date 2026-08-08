+++
title = "Right Answer, Wrong Work"
id = "right-answer-wrong-work"
type = "tells"
aliases = ["/slopodar/right-answer-wrong-work/"]
domain = "tests"
detected = "2026-02-28"
confidence = "strong"
trigger = "expect(result.status).toBe(400): test passes, but the 400 comes from a different validation than the test claims to verify"
description = "A test that asserts the correct outcome via the wrong causal path. The assertion passes, the gate is green, but nobody traces the execution path to check whether the test verifies what it claims to verify. The LLM optimises for the shape of correctness (matching expected output) without verifying which code path produced it."
detect = "For each test: can you change the implementation to break the claimed behaviour while keeping the test green? If yes, the test asserts the answer, not the reason. Check: does the assertion reference an error code, message, or structural marker that identifies the specific rejection point?"
instead = "Assert why it failed, not just that it failed. `expect(result.status).toBe(400)` is wrong work. `expect(result.error.code).toBe('INVALID_JSON')` shows the work."
severity = "high"
refs = ["SD-190 (governance recursion: plausible-but-wrong tests named)", "Bugbot finding on PR #386 V-03c (array body passes for wrong reason)"]
evidence = ["METR RCT (2025): developers 19% slower with AI, believed 20% faster. arXiv:2507.09089"]
+++
