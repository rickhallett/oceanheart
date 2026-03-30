+++
title = "33,700 tokens on boot and nobody noticed"
date = "2026-03-01"
description = "I pointed a tokeniser at the repo. The boot sequence had an elephant in it."
tags = ["agents", "tokens", "infrastructure", "discipline"]
draft = false
+++

```
  BOOT SEQUENCE (read on every agent wake)

    33.7k  ████████████████████████████████████████  session-decisions.md
     6.2k  ████████                                  analyst.md
     4.6k  ██████                                    lexicon.md
     4.6k  ██████                                    quartermaster.md
     4.3k  ██████                                    AGENTS.md
     3.2k  ████                                      architect.md
     2.7k  ████                                      anotherpair.md
     2.6k  ████                                      weaver.md
     2.5k  ███                                       watchdog.md
     2.5k  ███                                       sentinel.md
     2.4k  ███                                       janitor.md
     2.3k  ███                                       dead-reckoning.md
     2.0k  ███                                       scribe.md
     1.7k  ███                                       keel.md
     1.2k  ██                                        maturin.md
  ───────
   112.9k  BOOT TOTAL
```

```
files     = git ls-files
tokenizer = cl100k_base

for file in files:
    tokens = encode(content).length + encode(path).length

sort descending
tag boot files
```

5 agent-minutes to build. 3 seconds to run. The fix (stop loading all 271 historical decisions on every wake) drops 30k tokens from the boot sequence.[^1]

[Provenance](https://github.com/rickhallett/thepit/blob/wake/docs/internal/weaver/token-heatmap.yaml) | [Script](https://github.com/rickhallett/thepit/blob/wake/bin/token-heatmap.js)

[^1]: The heaviest directory in the repo is `docs/internal/research/mobprogrammingrpg/` at 1,148,700 tokens. Twelve PDFs. ["We are not doing PDFs."](https://github.com/rickhallett/thepit/blob/7e5675ab89d28d86baf5a47847d53a4e84918efc/docs/internal/anotherpair/log.md#we-are-not-doing-pdfs-2026-03-01)
