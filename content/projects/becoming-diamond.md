+++
title = "Becoming Diamond"
date = "2026-05-20"
description = "Paid client build, production and customer-facing: a marketing site plus a gated member portal delivering a 30-day video course, with AI chat, Stripe membership, and a git-based CMS for non-technical editing. Next.js, React 19, TypeScript, Stripe, Decap CMS."
tags = ["nextjs", "react", "typescript", "stripe", "cms", "client-work"]
track = "client"
tier = "notable"
weight = 20
status = "production"
live = "https://becoming-diamond.vercel.app/"
summary = "production client product"
principle = "Shipped, paid for, and edited by the client themselves."
+++

{{< claude-coach
  prompt="Read https://www.oceanheart.ai/projects/becoming-diamond/ and interrogate the product architecture with me: how the marketing site, gated course, AI chat, Stripe membership, and client-editable CMS fit together; where access-control or lifecycle failures could emerge; and what you would probe first in a design review."
  title="Interrogate this architecture"
  description="Open a Claude conversation primed to examine the boundaries between membership, course delivery, AI chat, payments, and client-owned content."
  action="Discuss it with Claude" >}}


## What it is

A paid client product, in production and serving customers: a public marketing site and a gated member portal behind it. The portal delivers a 30-day video course, an AI chat assistant scoped to the course material, Stripe-backed membership, and a git-based CMS so the client edits their own content without touching code.

## What I built

Built across the full stack, front end, backend integration, payments, content workflows, and deployment.

- **Gated member portal**, authentication and access control around the paid course.
- **30-day video course delivery**, the course content sequenced and served through the portal.
- **AI chat**, an assistant scoped to the course material.
- **Stripe membership**, checkout and subscription lifecycle.
- **Decap (git-based) CMS**, the client edits content through a friendly interface; every change is a commit, so the content history is versioned and reversible.

## Stack

Next.js, React 19, TypeScript, Stripe, Decap CMS, deployed on Vercel.

[Visit the site &rarr;](https://becoming-diamond.vercel.app/)
