+++
title = "Agent-native infrastructure: Linux never abandoned the CLI"
date = "2026-03-26"
description = "5 system/infrastructure categories. All fully reducible. File management, monitoring, networking, cloud consoles, backup. Every GUI in this section is a convenience wrapper over CLI operations."
tags = ["agent-native", "infrastructure", "linux", "cli", "devops"]
draft = true
+++

{{< draft-notice >}}

## All 5 fully reducible

File management, system monitoring, networking, cloud consoles, backup/sync. This section was the easiest to assess - infrastructure tooling has always been built by and for people who work in terminals. The GUI layer on top is consistently optional.

## File management

This is the most obviously CLI-native category. `cp`, `mv`, `rm`, `mkdir`, `find`, `rsync`, `tar`, `zip` - these commands predate GUIs by decades. Finder, Explorer, Nautilus - they're visual wrappers over filesystem operations. Drag-and-drop is `mv`. Double-click is `xdg-open`. The recycle bin is a hidden directory.

An agent managing files doesn't need spatial layout, icon previews, or column views. It has the path. It runs the command.

## System monitoring

`htop`, `top`, `vmstat`, `iostat`, `sar`, `netstat`, `ss`, `df`, `du`, `free` - system monitoring was CLI-first and remains CLI-first. Grafana, Datadog, and New Relic add dashboards, alerting, and historical aggregation. All three expose APIs. Prometheus is a time-series database queried via PromQL, stored as metrics, scraped from exporters. The dashboard is a rendering layer.

The agent checks CPU usage with `mpstat`, disk with `df`, memory with `free`, network with `ss`. It queries Prometheus directly. It evaluates thresholds and triggers alerts through the API. The graph exists so humans can see trends over time. The agent computes the trend from the numbers.

## Cloud consoles

AWS, GCP, Azure - these are API-first companies. The console came after the API. `aws`, `gcloud`, `az` CLIs cover every service. Terraform and Pulumi manage infrastructure as code. CloudFormation is a YAML/JSON template submitted via API.

The AWS console is reportedly millions of lines of frontend code. Every button click maps to an API request. Which is quite a lot of engineering to produce a button.

## Networking

`ssh`, `scp`, `curl`, `wget`, `dig`, `nslookup`, `traceroute`, `iptables`, `nftables`, `wireguard-tools` - networking has always been CLI territory. Network GUIs exist primarily for home routers and Windows environments where administrators expect graphical interfaces. The underlying configuration is text files and commands.

## Backup and sync

`rsync`, `restic`, `borgbackup`, `rclone` - backup tools are automation by definition. A backup that requires manual intervention is a backup that won't happen. Scheduled, verified, rotated - all of this is scripted. The GUI (Backblaze desktop app, Time Machine preferences) sets up the schedule and shows progress. The agent runs `restic backup` on a cron.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 24-28 (System/Infrastructure section)
