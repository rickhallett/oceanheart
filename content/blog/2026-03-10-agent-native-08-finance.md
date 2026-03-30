+++
title = "Agent-native finance: plain-text accounting is a mature paradigm"
date = "2026-03-29"
description = "4 finance/business categories. hledger and beancount implement full double-entry bookkeeping from CLI. Algorithmic trading is already agent-native by definition."
tags = ["agent-native", "finance", "accounting", "trading"]
draft = true
+++

{{< draft-notice >}}

## 4 categories

Accounting, invoicing, trading platforms, ERP systems. Most of this section is straightforward, but the plain-text accounting ecosystem is worth dwelling on because it's the cleanest example of something that's already agent-native and working in production.

## Plain-text accounting

This is the cleanest example of an agent-native paradigm that already exists and works. `hledger` and `beancount` implement full double-entry bookkeeping. Transactions are text files. Reports are CLI queries. The ledger is version-controlled in git.

```
2026-03-10 Office supplies
    expenses:office    45.00
    assets:checking   -45.00
```

That's a transaction. `hledger balance` gives you a balance sheet. `hledger incomestatement` gives you an income statement. `hledger register expenses:office` gives you a ledger view. No GUI needed, no database needed, no SaaS subscription needed.

QuickBooks and Xero provide GUIs for entering transactions, categorising expenses, and generating reports. The underlying operations are the same: record debits and credits, query balances, generate reports. The GUI provides a form-based entry interface and visual charts. The computation is arithmetic.

## Invoicing

An invoice is structured data (vendor, client, line items, amounts, dates, payment terms) rendered into a document. Template rendering: populate a template with data, produce a PDF. `weasyprint`, `pandoc`, `latex` - multiple tools handle this. Invoice generation is a solved problem in every programming language.

Sending the invoice is an API call (email or accounting platform API). Tracking payment status is a database query. The invoicing GUI (FreshBooks, Invoice Ninja) provides a visual editor for the template and a dashboard for outstanding invoices. The agent generates and sends invoices programmatically.

## Trading platforms

Algorithmic trading is already agent-native by definition. Algorithms don't look at candlestick charts. They consume price feeds (websockets or REST APIs), compute signals, and submit orders. Interactive Brokers has a well-documented API. Alpaca is API-first. `ccxt` provides a unified API across cryptocurrency exchanges.

The trading GUI (TradingView, ThinkOrSwim) exists for discretionary traders who make decisions by looking at charts. Technical analysis indicators are mathematical functions on price series, computable without visualisation. The chart is a human decision-support tool.

## ERP systems

SAP, Oracle, NetSuite - these are large, integrated databases covering finance, HR, supply chain, manufacturing. They have APIs and scripting layers (SAP ABAP, Oracle PL/SQL, NetSuite SuiteScript). The GUI exists because thousands of employees across an organisation need to interact with the system daily, each seeing a role-specific view of the data.

An agent uses the API. Worth noting: the complexity of ERP isn't in the interface. It's in the business logic and data model, and that complexity doesn't go away when you remove the GUI. You just access it differently.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Categories 37-40 (Finance/Business section)
