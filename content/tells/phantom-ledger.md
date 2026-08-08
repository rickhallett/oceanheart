+++
title = "Phantom Ledger"
id = "phantom-ledger"
type = "tells"
aliases = ["/slopodar/phantom-ledger/"]
domain = "code"
detected = "2026-03-02"
confidence = "medium"
trigger = "settleCredits writes deltaMicro: -20 to the ledger when the SQL only deducted 5."
description = "The LLM builds a correct operation but records a different value in the audit trail. The billing SQL caps a deduction; the ledger records the uncapped intended charge. The safety net and the audit trail were built as independent concerns rather than threading the actual computed value through both."
detect = "In financial code: trace the value from computation through to the audit record. Are they the same variable, or computed independently? If independently computed, the books may not balance."
instead = "Use a RETURNING clause to capture the actual value, then write that value to the ledger."
severity = "high"
refs = ["wake:lib/credits.ts: settleCredits function"]
+++
