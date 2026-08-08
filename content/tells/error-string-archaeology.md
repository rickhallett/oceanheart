+++
title = "Error String Archaeology"
id = "error-string-archaeology"
type = "tells"
aliases = ["/slopodar/error-string-archaeology/"]
domain = "code"
detected = "2026-03-02"
confidence = "low"
trigger = "message.includes('rate') || message.includes('429'): guessing at error message format."
description = "Error classification by guessing what error messages probably look like, rather than using the provider SDK's typed error hierarchy. The Anthropic SDK exposes RateLimitError, APIConnectionTimeoutError, etc. The LLM reaches for string matching because it's the highest-frequency pattern in training data."
detect = "Search for `message.includes()` or regex on error messages in code that uses a provider SDK. Check if the SDK offers typed error classes."
instead = "Use `instanceof` checks against the SDK's error types, or check HTTP status codes on the error object."
severity = "medium"
refs = ["wake:app/api/run-bout/route.ts: onError callback"]
+++
