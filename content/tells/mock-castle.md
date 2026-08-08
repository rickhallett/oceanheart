+++
title = "Mock Castle"
id = "mock-castle"
type = "tells"
aliases = ["/slopodar/mock-castle/"]
domain = "tests"
detected = "2026-03-02"
confidence = "medium"
trigger = "21 vi.mock() calls, 65 lines of mock setup, 45 lines of assertions. Testing a 4-line function."
description = "Mock scaffolding consumes more lines and cognitive load than the actual assertions. The test primarily verifies mock wiring, not product behaviour. A 4:1 mock-to-assertion ratio provides less regression confidence than its line count implies."
detect = "Count mock declarations vs test assertions per file. If mock setup exceeds 3x assertion code, the test is a castle built on sand."
instead = "Extract pure functions into a separate module with no side-effect imports. Test them without mocking the universe."
severity = "high"
refs = ["wake:tests/unit/bout-engine-helpers.test.ts: 21 vi.mock()"]
+++
