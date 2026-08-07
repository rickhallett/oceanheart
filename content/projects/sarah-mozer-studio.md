+++
title = "Sarah Mozer Studio"
date = "2026-07-23"
description = "Paid client build for a Dorset artist: a production commerce site with a typed TinaCMS catalogue, Stripe Checkout, finite-stock controls, and a protected owner workflow. Next.js, TypeScript, TinaCMS, Stripe, Neon."
tags = ["nextjs", "typescript", "tinacms", "stripe", "neon", "client-work"]
track = "client"
tier = "flagship"
weight = 15
status = "production"
live = "https://www.sarahmozer.org/"
caseStudy = "/blog/2026-07-23-the-agent-knew-which-plus-button-she-meant/"
+++

{{< claude-coach
  prompt="Read https://www.oceanheart.ai/projects/sarah-mozer-studio/ and interrogate the commerce architecture with me: the boundaries between TinaCMS, the public catalogue, Stripe Checkout, the Neon order projection, and finite-stock controls; how owner editing stays safe; and what failure modes you would probe first."
  title="Interrogate this architecture"
  description="Open a Claude conversation primed to examine content ownership, checkout, order projection, finite stock, and the protected editing boundary."
  action="Discuss it with Claude" >}}


## What it is

A production commerce system for Dorset artist Sarah Mozer. The public site, product catalogue, checkout, inventory controls, order projection, content workflow, and owner guidance were designed as one operating system with a low administrative burden.

## What I built

- A typed Next.js and TinaCMS catalogue for artwork, prints, and cards.
- Live Stripe Checkout with a Neon-backed order projection.
- Fail-closed finite-stock controls around products that cannot be oversold.
- Protected technical fields alongside a safe editing surface for customer-facing words and images.
- An owner guide and annotated live-CMS support so Sarah can make routine changes without touching code.

I led discovery, implementation, deployment, and ongoing support. The payment path and signed webhook processing were verified end to end in test mode before the live cutover.

## Stack

Next.js, TypeScript, TinaCMS, Stripe, Neon, Vercel.

[Visit Sarah Mozer Studio &rarr;](https://www.sarahmozer.org/)

[Read the field note about supporting the live CMS &rarr;](/blog/2026-07-23-the-agent-knew-which-plus-button-she-meant/)
