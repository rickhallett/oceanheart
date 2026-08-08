+++
title = "Phantom Tollbooth"
id = "phantom-tollbooth"
type = "tells"
aliases = ["/slopodar/phantom-tollbooth/"]
domain = "tests"
detected = "2026-03-02"
confidence = "medium"
trigger = "expect([400, 401, 402, 403, 404]).toContain(response.status): a security test that accepts 5 error codes."
description = "An error-path test with an assertion so loose it cannot distinguish between the intended error and several unrelated failure modes. If the ownership check were removed entirely, the test would still pass."
detect = "Check assertions that accept ranges or arrays of status codes. The wider the range, the less the test constrains. If removing the feature under test wouldn't break the assertion, the test is a phantom tollbooth."
instead = "Pin to the exact expected code and error message. `expect(response.status).toBe(403)`."
severity = "high"
refs = ["wake:tests/integration/security/auth-bypass.test.ts"]
+++
