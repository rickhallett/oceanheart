+++
title = "The Confessional Test"
id = "confessional-test"
type = "tells"
aliases = ["/slopodar/confessional-test/"]
domain = "tests"
detected = "2026-03-02"
confidence = "low"
trigger = "'the catch branch is unreachable... verified by inspection.' Then writes an assertion identical to the happy path."
description = "A test for an unreachable branch that the LLM explicitly acknowledges is unreachable, then writes an assertion that cannot fail."
detect = "Search for test comments longer than the assertion they accompany. If the comment explains why the test can't verify what its name claims, it's a confessional."
instead = "Delete the test. Add a comment to the source code."
severity = "medium"
refs = ["wake:tests/unit/bout-engine-helpers.test.ts: H-08"]
+++
