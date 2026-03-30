+++
title = "Agent-native communication: the meeting is irreducible"
date = "2026-03-25"
description = "4 communication categories. Video conferencing is the only truly irreducible category in the entire taxonomy. Email, chat, and social media are mostly reducible."
tags = ["agent-native", "communication", "meetings", "email"]
draft = true
+++

{{< draft-notice >}}

## The irreducible category

Video conferencing is one of only two genuinely irreducible categories in the whole taxonomy. The core activity is humans talking to humans - there's no programmatic equivalent to a conversation.

You can automate everything around the meeting: scheduling (API call), recording (media capture), transcribing (speech-to-text), summarising (language model), distributing action items (task API). But the meeting itself - reading expressions, negotiating, the politics - that's the thing. Zoom's API handles the logistics. The video feed of human faces is the product, not chrome over the product.

## Email and messaging

Email was covered in the productivity post, but it appears again here because communication tools overlap with productivity tools. The relevant addition: Slack, Discord, and Teams all expose APIs. Slack's API is comprehensive - channels, messages, reactions, threads, file uploads, user management. `slack-cli` exists. Discord has a bot API that's arguably better documented than its GUI features.

The pattern across all messaging platforms: sending and receiving messages is an API call. Organising conversations is CRUD on structured data. The chat interface exists so humans can follow a threaded, timestamped conversation visually. The agent works with the API response directly.

## Social media management

Posting, scheduling, analytics, engagement metrics - these are API operations. Buffer, Hootsuite, and Sprout Social are GUIs over platform APIs (Twitter/X API, Meta Graph API, LinkedIn API). The agent posts via API, queries metrics via API, and schedules via cron or a task queue.

The taste boundary: what to post, how to respond to a crisis, when to engage and when to stay silent. Brand voice, audience reading, timing - these are judgment calls. The mechanical parts (actually posting, pulling analytics, generating reports) are trivial.

## CRM

Salesforce, HubSpot - these are databases with domain-specific schemas. Contacts, deals, pipelines, activities. Both have REST APIs. The pipeline board in HubSpot is a visualisation of records with a status field. The agent queries and updates records directly.

The part that still needs a person: relationship judgment. Which leads to prioritise, how to handle a difficult account, when to escalate. The CRM itself is just bookkeeping.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 20-23 (Communication section)
