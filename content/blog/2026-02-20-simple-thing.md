+++
title = "The simple thing is the right thing"
date = "2026-02-20"
description = "I asked my agent how to trigger a daily Vercel rebuild. It gave me deploy hooks, environment variables, logging scripts. I asked why."
tags = ["agents", "simplicity", "over-engineering"]
draft = false
+++

I needed a cron job to rebuild my Vercel site daily. Scheduled publishing. Posts with a future `publishDate` become visible when their date passes.

I asked the agent how to set this up.

It gave me a bash script with environment variable handling, HTTP response code parsing, a separate log file, multi-step setup instructions, and a deploy hook approach that required going into the Vercel dashboard.

```bash
HOOK_URL="${VERCEL_DEPLOY_HOOK:-}"
LOG_FILE="/tmp/vercel-rebuild.log"

if [ -z "$HOOK_URL" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: VERCEL_DEPLOY_HOOK not set" >> "$LOG_FILE"
  exit 1
fi

response=$(curl -s -X POST "$HOOK_URL" -w "%{http_code}" -o /tmp/vercel-response.json)
# ... and so on
```

I asked: why these choices, over a simple `at time, exec vercel --prod in this dir`?

"Honestly? No good reason."

One line in crontab does the job:

```bash
0 6 * * * cd /path/to/site && vercel --prod --yes >> /tmp/vercel-rebuild.log 2>&1
```

I already have `vercel` installed. I'm already authenticated. The machine is on. The agent didn't ask what I already had. It assumed a greenfield setup and built accordingly. Environment variables, error handling, HTTP response codes, separate script files. It looks like the kind of thing you'd find in a tutorial.

When I pushed back, it immediately agreed. No defensiveness. That in itself is worth noticing. The agent has no attachment to its own solution. It optimises for looking thorough, then drops everything the moment you question it. Both of those things are problems, depending on context.
