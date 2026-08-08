+++
title = "Schema Shadow"
id = "schema-shadow"
type = "tells"
aliases = ["/slopodar/schema-shadow/"]
domain = "tests"
detected = "2026-03-02"
confidence = "low"
trigger = "// Minimal schema matching lib/env.ts structure: the test rebuilds the schema from scratch."
description = "The test reconstructs a validation schema instead of importing the real one. Changes to the real schema go undetected. Born stale by design."
detect = "Search test files for comments containing \"matching\" or \"mirroring\" followed by a source file path. If the test defines its own schema instead of importing, it's a shadow."
instead = "Export the schema separately from the module-level parse call. Test the exported schema directly."
severity = "medium"
refs = ["wake:tests/unit/env.test.ts"]
+++
