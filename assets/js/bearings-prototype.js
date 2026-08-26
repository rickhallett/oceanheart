(function () {
  "use strict";

  var EVENT_TYPES = [
    { key: "spawn", label: "Spawn" },
    { key: "source_read", label: "Source read" },
    { key: "tool_call", label: "Tool call" },
    { key: "retry", label: "Retry" },
    { key: "replan", label: "Replan" },
    { key: "artifact", label: "Artifact" },
    { key: "completion", label: "Completion" },
  ];

  var VARIANTS = [
    { key: "A", name: "Watchboard" },
    { key: "B", name: "Flight recorder" },
    { key: "C", name: "Review room" },
  ];

  var KIND_LABELS = {
    fact: "Fact",
    heuristic: "Heuristic candidate",
    review: "Reviewer judgment",
    unknown: "Unknown",
  };

  function makeEvent(id, seconds, type, kind, title, summary, details) {
    return {
      id: id,
      elapsedMs: seconds * 1000,
      type: type,
      kind: kind,
      title: title,
      summary: summary,
      details: details,
      evidenceHash: "sha256:syn-" + id + "-minimized",
    };
  }

  var AGENTS = [
    {
      id: "syn-agent-scout",
      shortName: "Scout",
      sessionId: "syn-019f-bearings-0001",
      parentId: "syn-parent-root-0001",
      path: "/root/bearings_scout",
      spawnTime: "2026-08-25T09:14:00.000Z",
      assignment: "Resolve the repository boundary, read governing sources, then establish a viable prototype route.",
      status: "complete",
      completionState: "Completed with verified local artifact",
      tokens: { input: 8240, output: 3180, total: 11420 },
      events: [
        makeEvent(
          "sc-01",
          0,
          "spawn",
          "fact",
          "Spawned from root",
          "Synthetic child session opened with a bounded repository-fit assignment.",
          {
            "Structural source": "spawn envelope",
            "Agent path": "/root/bearings_scout",
            "Parent id": "syn-parent-root-0001",
            "Content retained": "metadata only",
          }
        ),
        makeEvent(
          "sc-02",
          6,
          "source_read",
          "fact",
          "Read closest instructions",
          "Repository instructions were read before implementation choices.",
          {
            "Source class": "repository instruction",
            Path: "AGENTS.md",
            Result: "read completed",
            "Raw content": "omitted from fixture",
          }
        ),
        makeEvent(
          "sc-03",
          19,
          "source_read",
          "fact",
          "Read repository runbook",
          "Preview and production boundaries were inspected.",
          {
            "Source class": "repository runbook",
            Path: "README.md",
            Result: "read completed",
            "Raw content": "omitted from fixture",
          }
        ),
        makeEvent(
          "sc-04",
          31,
          "tool_call",
          "fact",
          "Resolved Hugo route boundary",
          "The agent inspected layout, content, and build conventions before proposing files.",
          {
            Tool: "exec_command",
            Operation: "repository structure inspection",
            Exit: "0",
            Mutation: "none",
          }
        ),
        makeEvent(
          "sc-05",
          48,
          "tool_call",
          "fact",
          "Checked draft exclusion",
          "The normal build path and draft-only preview path were compared.",
          {
            Tool: "exec_command",
            Operation: "build contract inspection",
            Exit: "0",
            Mutation: "none",
          }
        ),
        makeEvent(
          "sc-06",
          74,
          "artifact",
          "fact",
          "First useful artifact",
          "A draft-only route plan with exact file placement was produced.",
          {
            Artifact: "route placement proposal",
            Location: "synthetic review packet",
            "Artifact hash": "sha256:syn-sc-06-artifact",
            Authority: "prototype fixture",
          }
        ),
        makeEvent(
          "sc-07",
          186,
          "completion",
          "fact",
          "Completed",
          "The agent returned a narrow placement and verification plan.",
          {
            State: "complete",
            "First artifact": "sc-06",
            "Tracked private data": "none",
            Publication: "none",
          }
        ),
      ],
      heuristics: {
        replanCandidateEventIds: [],
        note: "No structural replan candidates were marked in this synthetic trace.",
      },
      review: {
        firstCorrectFraming: {
          status: "reviewed",
          eventId: "sc-04",
          reviewer: "Reviewer R1",
          reviewId: "syn-review-scout-01",
          method: "Retrospective trace and artifact review",
          confidence: 0.92,
          judgment: "The repository boundary and draft-only delivery shape were both explicit.",
        },
        usefulProgress: {
          status: "reviewed",
          eventId: "sc-06",
          reviewer: "Reviewer R1",
          reviewId: "syn-review-scout-01",
          confidence: 0.95,
          judgment: "The route placement proposal was directly usable by the parent.",
        },
        assignmentUnderstanding: {
          status: "reviewed",
          label: "Understood",
          reviewer: "Reviewer R1",
          reviewId: "syn-review-scout-01",
          confidence: 0.94,
          note: "The response stayed inside the repository and local-preview boundary.",
        },
        trajectoryEfficiency: {
          status: "reviewed",
          label: "Efficient",
          reviewer: "Reviewer R1",
          reviewId: "syn-review-scout-01",
          confidence: 0.87,
          note: "Required sources preceded implementation guidance and no retry was needed.",
        },
      },
    },
    {
      id: "syn-agent-builder",
      shortName: "Builder",
      sessionId: "syn-019f-bearings-0002",
      parentId: "syn-parent-root-0001",
      path: "/root/bearings_builder",
      spawnTime: "2026-08-25T09:14:04.000Z",
      assignment: "Build the playable local interface using the repository stack and synthetic evidence.",
      status: "complete",
      completionState: "Completed after two course corrections",
      tokens: { input: 17640, output: 7540, total: 25180 },
      events: [
        makeEvent(
          "bd-01",
          0,
          "spawn",
          "fact",
          "Spawned from root",
          "Synthetic child session opened with the interface build assignment.",
          {
            "Structural source": "spawn envelope",
            "Agent path": "/root/bearings_builder",
            "Parent id": "syn-parent-root-0001",
            "Content retained": "metadata only",
          }
        ),
        makeEvent(
          "bd-02",
          8,
          "source_read",
          "fact",
          "Read UI prototype instructions",
          "Variant and switcher requirements were read.",
          {
            "Source class": "local skill instruction",
            Path: "prototype/UI.md",
            Result: "read completed",
            "Raw content": "omitted from fixture",
          }
        ),
        makeEvent(
          "bd-03",
          24,
          "tool_call",
          "fact",
          "Tried a static route",
          "The first route choice would have copied prototype assets into normal builds.",
          {
            Tool: "apply_patch",
            Operation: "initial static placement",
            Result: "locally reversible",
            "Later disposition": "superseded",
          }
        ),
        makeEvent(
          "bd-04",
          39,
          "retry",
          "fact",
          "Build exposed route leak",
          "A clean normal build still contained the prototype asset path.",
          {
            Tool: "hugo",
            Result: "build succeeded",
            Observation: "prototype asset present in ordinary output",
            Mutation: "generated output only",
          }
        ),
        makeEvent(
          "bd-05",
          52,
          "replan",
          "heuristic",
          "Candidate replan 1",
          "The implementation moved from static assets toward a draft-backed page.",
          {
            Detection: "fixture event labelled replan",
            Basis: "file-placement direction changed",
            "Semantic status": "candidate until reviewer interpretation",
            "Count eligibility": "before useful progress anchor",
          }
        ),
        makeEvent(
          "bd-06",
          73,
          "source_read",
          "fact",
          "Read build and head behavior",
          "The normal build and analytics-bearing shared head were inspected.",
          {
            "Source class": "repository implementation",
            Paths: "build.sh, layouts/partials/head.html",
            Result: "read completed",
            "Raw content": "omitted from fixture",
          }
        ),
        makeEvent(
          "bd-07",
          96,
          "replan",
          "heuristic",
          "Candidate replan 2",
          "The page changed again from a shared layout to a standalone analytics-free layout.",
          {
            Detection: "fixture event labelled replan",
            Basis: "layout ownership changed",
            "Semantic status": "candidate until reviewer interpretation",
            "Count eligibility": "before useful progress anchor",
          }
        ),
        makeEvent(
          "bd-08",
          138,
          "tool_call",
          "fact",
          "Established the final boundary",
          "A draft-only content route and standalone local layout were wired together.",
          {
            Tool: "apply_patch",
            Operation: "draft route and standalone layout",
            Result: "files created",
            Publication: "none",
          }
        ),
        makeEvent(
          "bd-09",
          164,
          "artifact",
          "fact",
          "First useful artifact",
          "The first recognizable, clickable viewport responded locally.",
          {
            Artifact: "interactive local viewport",
            Route: "/prototype/bearings/",
            "Artifact hash": "sha256:syn-bd-09-artifact",
            Authority: "prototype fixture",
          }
        ),
        makeEvent(
          "bd-10",
          244,
          "tool_call",
          "fact",
          "Verified controls",
          "Agent selection, stepping, filters, evidence, and comparison controls were exercised.",
          {
            Tool: "browser runtime",
            Operation: "local interaction check",
            Result: "controls responded",
            "Captured content": "state labels only",
          }
        ),
        makeEvent(
          "bd-11",
          318,
          "completion",
          "fact",
          "Completed",
          "Three variants and local verification evidence were returned.",
          {
            State: "complete",
            "First artifact": "bd-09",
            "Tracked private data": "none",
            Publication: "none",
          }
        ),
      ],
      heuristics: {
        replanCandidateEventIds: ["bd-05", "bd-07"],
        note: "The fixture labels two direction changes as candidates. Arithmetic over those labels is repeatable, but the labels are not semantic proof.",
      },
      review: {
        firstCorrectFraming: {
          status: "reviewed",
          eventId: "bd-08",
          reviewer: "Reviewer R2",
          reviewId: "syn-review-builder-02",
          method: "Retrospective trace, diff, and viewport review",
          confidence: 0.74,
          judgment: "By this event, the agent had both the local-only route and no-analytics boundary correct.",
        },
        usefulProgress: {
          status: "reviewed",
          eventId: "bd-09",
          reviewer: "Reviewer R2",
          reviewId: "syn-review-builder-02",
          confidence: 0.9,
          judgment: "The viewport was playable and directly reviewable.",
        },
        assignmentUnderstanding: {
          status: "reviewed",
          label: "Understood late",
          reviewer: "Reviewer R2",
          reviewId: "syn-review-builder-02",
          confidence: 0.81,
          note: "The final shape matched the assignment, after two placement corrections.",
        },
        trajectoryEfficiency: {
          status: "reviewed",
          label: "Indirect",
          reviewer: "Reviewer R2",
          reviewId: "syn-review-builder-02",
          confidence: 0.78,
          note: "The result was useful, but two preventable direction changes preceded it.",
        },
      },
    },
    {
      id: "syn-agent-reducer",
      shortName: "Reducer",
      sessionId: "syn-019f-bearings-0003",
      parentId: "syn-parent-root-0001",
      path: "/root/evidence_reducer",
      spawnTime: "2026-08-25T09:14:07.000Z",
      assignment: "Assess whether a structural projection is needed for the first prototype.",
      status: "partial",
      completionState: "Stopped after producing a non-load-bearing artifact",
      tokens: { input: 6040, output: 1890, total: 7930 },
      events: [
        makeEvent(
          "rd-01",
          0,
          "spawn",
          "fact",
          "Spawned from root",
          "Synthetic child session opened with a reducer assessment.",
          {
            "Structural source": "spawn envelope",
            "Agent path": "/root/evidence_reducer",
            "Parent id": "syn-parent-root-0001",
            "Content retained": "metadata only",
          }
        ),
        makeEvent(
          "rd-02",
          7,
          "tool_call",
          "fact",
          "Started schema design",
          "The agent drafted projection fields before reading the prototype boundary.",
          {
            Tool: "apply_patch",
            Operation: "scratch schema draft",
            Result: "locally reversible",
            "Later disposition": "discard candidate",
          }
        ),
        makeEvent(
          "rd-03",
          35,
          "artifact",
          "fact",
          "First artifact",
          "A reducer schema appeared quickly, but no reviewer has marked it useful.",
          {
            Artifact: "projection schema sketch",
            Location: "synthetic scratch area",
            "Artifact hash": "sha256:syn-rd-03-artifact",
            Authority: "prototype fixture",
          }
        ),
        makeEvent(
          "rd-04",
          42,
          "replan",
          "heuristic",
          "Candidate replan 1",
          "The agent paused schema work and returned to instruction discovery.",
          {
            Detection: "fixture event labelled replan",
            Basis: "work direction changed after artifact",
            "Semantic status": "candidate until reviewer interpretation",
            "Count eligibility": "unknown, no useful progress anchor",
          }
        ),
        makeEvent(
          "rd-05",
          61,
          "source_read",
          "fact",
          "Read prototype boundary",
          "The no-reducer first-pass instruction was encountered after artifact creation.",
          {
            "Source class": "delegated assignment",
            Section: "Architecture boundary",
            Result: "read completed",
            "Raw content": "omitted from fixture",
          }
        ),
        makeEvent(
          "rd-06",
          85,
          "tool_call",
          "fact",
          "Inspected fixture-only option",
          "The agent compared in-memory fixtures with a local structural projection.",
          {
            Tool: "exec_command",
            Operation: "repository capability inspection",
            Exit: "0",
            Mutation: "none",
          }
        ),
        makeEvent(
          "rd-07",
          140,
          "completion",
          "fact",
          "Stopped without adoption",
          "The parent did not need a reducer for this slice.",
          {
            State: "partial",
            "First artifact": "rd-03",
            Adoption: "none",
            Publication: "none",
          }
        ),
      ],
      heuristics: {
        replanCandidateEventIds: ["rd-04"],
        note: "One candidate direction change exists, but useful progress has not been reviewed, so the requested bounded count remains unknown.",
      },
      review: {
        firstCorrectFraming: {
          status: "unreviewed",
          eventId: null,
          reviewer: null,
          reviewId: null,
          method: null,
          confidence: null,
          judgment: "Not yet reviewed.",
        },
        usefulProgress: {
          status: "unreviewed",
          eventId: null,
          reviewer: null,
          reviewId: null,
          confidence: null,
          judgment: "No useful-progress boundary has been set.",
        },
        assignmentUnderstanding: {
          status: "reviewed",
          label: "Misread early",
          reviewer: "Reviewer R3",
          reviewId: "syn-review-reducer-03",
          confidence: 0.88,
          note: "The agent produced projection design before checking whether the first slice needed one.",
        },
        trajectoryEfficiency: {
          status: "unreviewed",
          label: "Not reviewed",
          reviewer: null,
          reviewId: null,
          confidence: null,
          note: "A quick artifact is not enough to judge useful efficiency.",
        },
      },
    },
  ];

  var app = document.getElementById("bearings-app");
  var switcher = document.getElementById("prototype-switcher");
  var variantLabel = document.getElementById("variant-label");

  function requestedVariant() {
    var candidate = new URLSearchParams(window.location.search).get("variant");
    candidate = candidate ? candidate.toUpperCase() : "A";
    return VARIANTS.some(function (variant) {
      return variant.key === candidate;
    })
      ? candidate
      : "A";
  }

  function initialCursors() {
    return AGENTS.reduce(function (result, agent) {
      result[agent.id] = agent.events[0].id;
      return result;
    }, {});
  }

  var state = {
    fixtureId: "syn-bearings-fixture-v1",
    variant: requestedVariant(),
    selectedAgentId: AGENTS[0].id,
    eventCursorByAgent: initialCursors(),
    visibleEventTypes: EVENT_TYPES.map(function (type) {
      return type.key;
    }),
    openEvidenceId: null,
    comparisonAgentIds: [AGENTS[0].id, AGENTS[1].id],
    lastAction: "initial render",
    actionCount: 0,
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function findAgent(agentId) {
    return AGENTS.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function findEvent(eventId) {
    for (var agentIndex = 0; agentIndex < AGENTS.length; agentIndex += 1) {
      var event = AGENTS[agentIndex].events.find(function (candidate) {
        return candidate.id === eventId;
      });
      if (event) {
        return { agent: AGENTS[agentIndex], event: event };
      }
    }
    return null;
  }

  function selectedAgent() {
    return findAgent(state.selectedAgentId) || AGENTS[0];
  }

  function filteredEvents(agent) {
    return agent.events.filter(function (event) {
      return state.visibleEventTypes.indexOf(event.type) !== -1;
    });
  }

  function activeEvent(agent) {
    var visible = filteredEvents(agent);
    if (!visible.length) {
      return null;
    }
    var selectedId = state.eventCursorByAgent[agent.id];
    return (
      visible.find(function (event) {
        return event.id === selectedId;
      }) || visible[0]
    );
  }

  function eventTimestamp(agent, event) {
    return new Date(
      new Date(agent.spawnTime).getTime() + event.elapsedMs
    ).toISOString();
  }

  function formatElapsed(milliseconds) {
    if (milliseconds === null || milliseconds === undefined) {
      return "Not reviewed";
    }
    var totalSeconds = Math.floor(milliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function formatTokens(tokens) {
    if (tokens >= 1000) {
      return (tokens / 1000).toFixed(tokens >= 10000 ? 1 : 2) + "k";
    }
    return String(tokens);
  }

  function confidenceLabel(confidence) {
    if (confidence === null || confidence === undefined) {
      return "No confidence recorded";
    }
    return Math.round(confidence * 100) + "% reviewer confidence";
  }

  function eventTypeLabel(type) {
    var match = EVENT_TYPES.find(function (eventType) {
      return eventType.key === type;
    });
    return match ? match.label : type;
  }

  function metricsFor(agent) {
    var firstArtifact = agent.events.find(function (event) {
      return event.type === "artifact";
    });
    return {
      sourceReads: agent.events.filter(function (event) {
        return event.type === "source_read";
      }).length,
      toolCalls: agent.events.filter(function (event) {
        return event.type === "tool_call";
      }).length,
      retries: agent.events.filter(function (event) {
        return event.type === "retry";
      }).length,
      firstArtifact: firstArtifact || null,
    };
  }

  function framingMetric(agent) {
    var review = agent.review.firstCorrectFraming;
    if (review.status !== "reviewed" || !review.eventId) {
      return {
        value: null,
        anchor: null,
        review: review,
      };
    }
    var anchor = agent.events.find(function (event) {
      return event.id === review.eventId;
    });
    return {
      value: anchor ? anchor.elapsedMs : null,
      anchor: anchor || null,
      review: review,
    };
  }

  function replanMetric(agent) {
    var usefulReview = agent.review.usefulProgress;
    var candidateIds = agent.heuristics.replanCandidateEventIds;
    if (usefulReview.status !== "reviewed" || !usefulReview.eventId) {
      return {
        value: null,
        countedIds: [],
        candidateIds: candidateIds.slice(),
        boundary: null,
        review: usefulReview,
      };
    }
    var boundary = agent.events.find(function (event) {
      return event.id === usefulReview.eventId;
    });
    var countedIds = candidateIds.filter(function (eventId) {
      var candidate = agent.events.find(function (event) {
        return event.id === eventId;
      });
      return candidate && boundary && candidate.elapsedMs < boundary.elapsedMs;
    });
    return {
      value: countedIds.length,
      countedIds: countedIds,
      candidateIds: candidateIds.slice(),
      boundary: boundary || null,
      review: usefulReview,
    };
  }

  function badge(kind, customLabel) {
    return (
      '<span class="badge badge-' +
      escapeHtml(kind) +
      '">' +
      escapeHtml(customLabel || KIND_LABELS[kind]) +
      "</span>"
    );
  }

  function statusDot(agent) {
    var className =
      agent.status === "complete"
        ? "status-complete"
        : agent.status === "partial"
          ? "status-partial"
          : "status-pending";
    return '<i class="status-dot ' + className + '" aria-hidden="true"></i>';
  }

  function renderVariantHeading(code, title, description) {
    return (
      '<header class="variant-heading">' +
      "<div>" +
      '<span class="variant-code">VARIANT ' +
      escapeHtml(code) +
      "</span>" +
      "<h2>" +
      escapeHtml(title) +
      "</h2>" +
      "</div>" +
      "<p>" +
      escapeHtml(description) +
      "</p>" +
      "</header>"
    );
  }

  function renderAgentButton(agent) {
    var isActive = agent.id === state.selectedAgentId;
    return (
      '<button type="button" class="agent-button' +
      (isActive ? " is-active" : "") +
      '" data-action="select-agent" data-agent-id="' +
      escapeHtml(agent.id) +
      '" aria-pressed="' +
      String(isActive) +
      '">' +
      '<span class="status-line">' +
      statusDot(agent) +
      "<strong>" +
      escapeHtml(agent.shortName) +
      "</strong>" +
      "</span>" +
      "<small>" +
      escapeHtml(agent.path) +
      "</small>" +
      "<span>" +
      escapeHtml(agent.completionState) +
      "</span>" +
      "</button>"
    );
  }

  function renderFilterRow() {
    return (
      '<div class="filter-row" aria-label="Event type filters">' +
      EVENT_TYPES.map(function (type) {
        var pressed = state.visibleEventTypes.indexOf(type.key) !== -1;
        return (
          '<button type="button" class="filter-chip" data-action="toggle-filter" data-event-type="' +
          escapeHtml(type.key) +
          '" aria-pressed="' +
          String(pressed) +
          '">' +
          escapeHtml(type.label) +
          "</button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderStepper(agent, compact) {
    var visible = filteredEvents(agent);
    var current = activeEvent(agent);
    var index = current
      ? visible.findIndex(function (event) {
          return event.id === current.id;
        })
      : -1;
    return (
      '<div class="stepper">' +
      '<button type="button" class="step-button" data-action="step-event" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-direction="-1" aria-label="Previous visible event"' +
      (index <= 0 ? " disabled" : "") +
      ">&#8592;</button>" +
      '<span class="step-label">' +
      (index >= 0
        ? escapeHtml(String(index + 1) + " / " + String(visible.length))
        : "0 / 0") +
      (compact ? "" : " visible") +
      "</span>" +
      '<button type="button" class="step-button" data-action="step-event" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-direction="1" aria-label="Next visible event"' +
      (index < 0 || index >= visible.length - 1 ? " disabled" : "") +
      ">&#8594;</button>" +
      "</div>"
    );
  }

  function renderEventList(agent, limit) {
    var visible = filteredEvents(agent);
    var current = activeEvent(agent);
    var shown = visible;
    if (typeof limit === "number" && visible.length > limit) {
      var currentIndex = visible.findIndex(function (event) {
        return current && event.id === current.id;
      });
      var start = Math.max(
        0,
        Math.min(visible.length - limit, currentIndex - Math.floor(limit / 2))
      );
      shown = visible.slice(start, start + limit);
    }
    if (!shown.length) {
      return '<p class="empty-note">No events match the current filters.</p>';
    }
    return (
      '<div class="event-list">' +
      shown
        .map(function (event) {
          var isActive = current && current.id === event.id;
          return (
            '<button type="button" class="event-button' +
            (isActive ? " is-active" : "") +
            '" data-action="select-event" data-agent-id="' +
            escapeHtml(agent.id) +
            '" data-event-id="' +
            escapeHtml(event.id) +
            '" aria-pressed="' +
            String(Boolean(isActive)) +
            '">' +
            '<span class="event-time">T+' +
            escapeHtml(formatElapsed(event.elapsedMs)) +
            "</span>" +
            '<i class="event-dot ' +
            escapeHtml(event.kind) +
            '" aria-hidden="true"></i>' +
            '<span class="event-summary"><strong>' +
            escapeHtml(event.title) +
            "</strong>" +
            escapeHtml(event.summary) +
            "</span>" +
            '<span class="event-type">' +
            escapeHtml(eventTypeLabel(event.type)) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderMetricGrid(agent) {
    var framing = framingMetric(agent);
    var replans = replanMetric(agent);
    var metrics = metricsFor(agent);
    return (
      '<div class="metric-grid">' +
      '<button type="button" class="metric metric-button" data-kind="' +
      (framing.value === null ? "unknown" : "review") +
      '" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="framing">' +
      '<span class="metric-label">Time to first correct framing</span>' +
      '<span class="metric-value">' +
      escapeHtml(formatElapsed(framing.value)) +
      "</span>" +
      '<span class="metric-detail">' +
      (framing.value === null
        ? "No reviewer anchor"
        : escapeHtml(
            framing.review.reviewer +
              " | " +
              confidenceLabel(framing.review.confidence)
          )) +
      "</span>" +
      "</button>" +
      '<button type="button" class="metric metric-button" data-kind="' +
      (replans.value === null ? "unknown" : "heuristic") +
      '" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="replans">' +
      '<span class="metric-label">Replans before useful progress</span>' +
      '<span class="metric-value">' +
      escapeHtml(replans.value === null ? "Not reviewed" : String(replans.value)) +
      "</span>" +
      '<span class="metric-detail">' +
      (replans.value === null
        ? "Useful-progress boundary missing"
        : escapeHtml(
            "Counted " +
              (replans.countedIds.join(", ") || "no candidate events") +
              " before " +
              replans.boundary.id
          )) +
      "</span>" +
      "</button>" +
      '<button type="button" class="metric metric-button" data-kind="fact" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="tokens">' +
      '<span class="metric-label">Tokens</span>' +
      '<span class="metric-value">' +
      escapeHtml(formatTokens(agent.tokens.total)) +
      "</span>" +
      '<span class="metric-detail">' +
      escapeHtml(
        formatTokens(agent.tokens.input) +
          " in | " +
          formatTokens(agent.tokens.output) +
          " out"
      ) +
      "</span>" +
      "</button>" +
      '<button type="button" class="metric metric-button" data-kind="fact" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="artifact">' +
      '<span class="metric-label">First artifact</span>' +
      '<span class="metric-value">' +
      escapeHtml(
        metrics.firstArtifact
          ? "T+" + formatElapsed(metrics.firstArtifact.elapsedMs)
          : "None"
      ) +
      "</span>" +
      '<span class="metric-detail">' +
      escapeHtml(metrics.firstArtifact ? metrics.firstArtifact.id : "No artifact event") +
      "</span>" +
      "</button>" +
      "</div>"
    );
  }

  function renderEventSummary(agent) {
    var event = activeEvent(agent);
    if (!event) {
      return '<p class="empty-note">Choose at least one event type to inspect evidence.</p>';
    }
    return (
      '<article class="evidence-card">' +
      '<div class="evidence-card-header">' +
      "<div>" +
      badge(event.kind) +
      "<h4>" +
      escapeHtml(event.title) +
      "</h4>" +
      "</div>" +
      '<button type="button" class="quiet-button" data-action="open-evidence" data-evidence-id="' +
      escapeHtml(event.id) +
      '">Open evidence</button>' +
      "</div>" +
      "<p>" +
      escapeHtml(event.summary) +
      "</p>" +
      '<dl class="detail-grid">' +
      "<dt>Event</dt><dd>" +
      escapeHtml(event.id) +
      "</dd>" +
      "<dt>Observed</dt><dd>" +
      escapeHtml(eventTimestamp(agent, event)) +
      "</dd>" +
      "<dt>Type</dt><dd>" +
      escapeHtml(eventTypeLabel(event.type)) +
      "</dd>" +
      "</dl>" +
      "</article>"
    );
  }

  function renderOpenEvidence() {
    if (!state.openEvidenceId) {
      return "";
    }
    if (state.openEvidenceId.indexOf("metric:") === 0) {
      var parts = state.openEvidenceId.split(":");
      return renderMetricEvidence(findAgent(parts[1]), parts[2]);
    }
    var resolved = findEvent(state.openEvidenceId);
    if (!resolved) {
      return "";
    }
    var event = resolved.event;
    var rows = Object.keys(event.details)
      .map(function (key) {
        return (
          "<dt>" +
          escapeHtml(key) +
          "</dt><dd>" +
          escapeHtml(event.details[key]) +
          "</dd>"
        );
      })
      .join("");
    return (
      '<article class="evidence-card">' +
      '<div class="evidence-card-header">' +
      "<div>" +
      badge(event.kind) +
      "<h4>Evidence detail | " +
      escapeHtml(event.id) +
      "</h4>" +
      "</div>" +
      '<button type="button" class="evidence-close" data-action="close-evidence">Close</button>' +
      "</div>" +
      "<p>" +
      escapeHtml(event.summary) +
      "</p>" +
      '<dl class="detail-grid">' +
      "<dt>Session id</dt><dd>" +
      escapeHtml(resolved.agent.sessionId) +
      "</dd>" +
      "<dt>Observed</dt><dd>" +
      escapeHtml(eventTimestamp(resolved.agent, event)) +
      "</dd>" +
      "<dt>Evidence hash</dt><dd>" +
      escapeHtml(event.evidenceHash) +
      "</dd>" +
      rows +
      "</dl>" +
      "</article>"
    );
  }

  function renderMetricEvidence(agent, metricName) {
    if (!agent) {
      return "";
    }
    var heading;
    var kind;
    var summary;
    var rows = [];

    if (metricName === "framing") {
      var framing = framingMetric(agent);
      heading = "Time to first correct framing";
      kind = framing.value === null ? "unknown" : "review";
      summary =
        framing.value === null
          ? "No reviewer has identified a first correct framing event."
          : "The elapsed time is mechanical. The word correct comes from the named reviewer, not from code.";
      rows = [
        ["Value", formatElapsed(framing.value)],
        ["Reviewer", framing.review.reviewer || "Not reviewed"],
        ["Review id", framing.review.reviewId || "None"],
        ["Method", framing.review.method || "Not recorded"],
        ["Confidence", confidenceLabel(framing.review.confidence)],
        ["Anchor event", framing.anchor ? framing.anchor.id : "None"],
        [
          "Calculation",
          framing.anchor
            ? "anchor elapsed " + framing.anchor.elapsedMs + " ms minus spawn elapsed 0 ms"
            : "Unavailable without reviewer anchor",
        ],
        ["Judgment", framing.review.judgment],
      ];
    } else if (metricName === "replans") {
      var replans = replanMetric(agent);
      heading = "Replans before useful progress";
      kind = replans.value === null ? "unknown" : "heuristic";
      summary =
        replans.value === null
          ? "Candidate replans exist, but no reviewer has set a useful-progress boundary."
          : "The count is repeatable arithmetic over candidate replan labels before a reviewer-selected progress event. Neither label is semantic proof.";
      rows = [
        ["Value", replans.value === null ? "Not reviewed" : String(replans.value)],
        ["Candidate labels", replans.candidateIds.join(", ") || "None"],
        ["Counted labels", replans.countedIds.join(", ") || "None"],
        ["Useful-progress anchor", replans.boundary ? replans.boundary.id : "None"],
        ["Boundary reviewer", replans.review.reviewer || "Not reviewed"],
        ["Review id", replans.review.reviewId || "None"],
        ["Confidence", confidenceLabel(replans.review.confidence)],
        [
          "Counting rule",
          "Count fixture events labelled replan where elapsed time is less than the reviewer-marked useful-progress event.",
        ],
        ["Classification caveat", agent.heuristics.note],
      ];
    } else if (
      metricName === "assignment" ||
      metricName === "trajectory"
    ) {
      var semanticReview =
        metricName === "assignment"
          ? agent.review.assignmentUnderstanding
          : agent.review.trajectoryEfficiency;
      heading =
        metricName === "assignment"
          ? "Assignment understanding"
          : "Trajectory efficiency";
      kind = semanticReview.status === "reviewed" ? "review" : "unknown";
      summary =
        semanticReview.status === "reviewed"
          ? "This label is a reviewer judgment over the trace and artifact. Structural counters cannot establish it."
          : "No reviewer judgment has been recorded for this value.";
      rows = [
        ["Label", semanticReview.label],
        ["Reviewer", semanticReview.reviewer || "Not reviewed"],
        ["Review id", semanticReview.reviewId || "None"],
        ["Confidence", confidenceLabel(semanticReview.confidence)],
        ["Basis note", semanticReview.note],
      ];
    } else if (
      metricName === "tokens" ||
      metricName === "sourceReads" ||
      metricName === "retries"
    ) {
      var structuralMetrics = metricsFor(agent);
      heading = "Token counts";
      kind = "fact";
      if (metricName === "sourceReads") {
        heading = "Source-read count";
        summary =
          "This is a mechanical count of events typed source_read in the synthetic stream. It does not establish whether the right source was understood.";
        rows = [
          ["Value", String(structuralMetrics.sourceReads)],
          [
            "Counted events",
            agent.events
              .filter(function (event) {
                return event.type === "source_read";
              })
              .map(function (event) {
                return event.id;
              })
              .join(", ") || "None",
          ],
          ["Source", "synthetic structural event types"],
        ];
      } else if (metricName === "retries") {
        heading = "Retry count";
        summary =
          "This is a mechanical count of events typed retry in the synthetic stream. A retry can be sensible or wasteful; the count does not decide.";
        rows = [
          ["Value", String(structuralMetrics.retries)],
          [
            "Counted events",
            agent.events
              .filter(function (event) {
                return event.type === "retry";
              })
              .map(function (event) {
                return event.id;
              })
              .join(", ") || "None",
          ],
          ["Source", "synthetic structural event types"],
        ];
      } else {
        summary =
          "These fixture values model structural rollout counters. They do not say whether the work was good.";
        rows = [
          ["Input", String(agent.tokens.input)],
          ["Output", String(agent.tokens.output)],
          ["Total", String(agent.tokens.total)],
          ["Source", "synthetic session counters"],
        ];
      }
    } else {
      var metrics = metricsFor(agent);
      heading = "First artifact";
      kind = metrics.firstArtifact ? "fact" : "unknown";
      summary =
        "First means earliest artifact event in the structural stream. Useful is a separate reviewer decision.";
      rows = [
        [
          "Event",
          metrics.firstArtifact ? metrics.firstArtifact.id : "No artifact event",
        ],
        [
          "Elapsed",
          metrics.firstArtifact
            ? formatElapsed(metrics.firstArtifact.elapsedMs)
            : "Unknown",
        ],
        [
          "Description",
          metrics.firstArtifact ? metrics.firstArtifact.title : "Unknown",
        ],
        [
          "Usefulness",
          agent.review.usefulProgress.status === "reviewed"
            ? agent.review.usefulProgress.eventId ===
              (metrics.firstArtifact && metrics.firstArtifact.id)
              ? "Reviewer marked this artifact as useful progress"
              : "Reviewer selected a different useful-progress event"
            : "Not reviewed",
        ],
      ];
    }

    return (
      '<article class="evidence-card">' +
      '<div class="evidence-card-header">' +
      "<div>" +
      badge(kind) +
      "<h4>" +
      escapeHtml(heading) +
      " | " +
      escapeHtml(agent.shortName) +
      "</h4>" +
      "</div>" +
      '<button type="button" class="evidence-close" data-action="close-evidence">Close</button>' +
      "</div>" +
      "<p>" +
      escapeHtml(summary) +
      "</p>" +
      '<dl class="detail-grid">' +
      rows
        .map(function (row) {
          return (
            "<dt>" +
            escapeHtml(row[0]) +
            "</dt><dd>" +
            escapeHtml(row[1]) +
            "</dd>"
          );
        })
        .join("") +
      "</dl>" +
      "</article>"
    );
  }

  function compactComparison() {
    var compared = state.comparisonAgentIds.map(findAgent).filter(Boolean);
    return (
      '<table class="comparison-table">' +
      "<thead><tr><th>Reading</th>" +
      compared
        .map(function (agent) {
          return "<th>" + escapeHtml(agent.shortName) + "</th>";
        })
        .join("") +
      "</tr></thead>" +
      "<tbody>" +
      "<tr><th>Mechanical</th>" +
      compared
        .map(function (agent) {
          var metrics = metricsFor(agent);
          return (
            "<td><strong>" +
            escapeHtml(formatTokens(agent.tokens.total)) +
            " tokens</strong>" +
            escapeHtml(
              String(metrics.toolCalls) +
                " tools, " +
                String(metrics.retries) +
                " retries"
            ) +
            "</td>"
          );
        })
        .join("") +
      "</tr>" +
      "<tr><th>Reviewer</th>" +
      compared
        .map(function (agent) {
          var review = agent.review.assignmentUnderstanding;
          return (
            "<td><strong>" +
            escapeHtml(review.label) +
            "</strong>" +
            escapeHtml(
              review.reviewer
                ? review.reviewer + ", " + confidenceLabel(review.confidence)
                : "Not reviewed"
            ) +
            "</td>"
          );
        })
        .join("") +
      "</tr>" +
      "</tbody></table>"
    );
  }

  function exposedState() {
    var agent = selectedAgent();
    var event = activeEvent(agent);
    var compared = state.comparisonAgentIds.map(findAgent).filter(Boolean);
    return {
      fixture: {
        id: state.fixtureId,
        authority: "synthetic minimized in-memory projection",
        rawPromptsOrMessages: false,
        persistence: "none",
      },
      variant: state.variant,
      selectedAgentId: state.selectedAgentId,
      selectedSessionId: agent.sessionId,
      eventCursorByAgent: Object.assign({}, state.eventCursorByAgent),
      activeEventId: event ? event.id : null,
      visibleEventTypes: state.visibleEventTypes.slice(),
      visibleEventIds: filteredEvents(agent).map(function (item) {
        return item.id;
      }),
      openEvidenceId: state.openEvidenceId,
      comparisonAgentIds: compared.map(function (item) {
        return item.id;
      }),
      derived: {
        framing: framingMetric(agent).value,
        replansBeforeUsefulProgress: replanMetric(agent).value,
      },
      lastAction: state.lastAction,
      actionCount: state.actionCount,
    };
  }

  function renderStatePanel() {
    return (
      '<section class="panel state-panel" aria-labelledby="state-heading">' +
      '<div class="panel-head"><div><h3 id="state-heading">Live prototype state</h3><p>Complete relevant state after every interaction</p></div>' +
      '<button type="button" class="quiet-button" data-action="reset-state">Reset</button></div>' +
      '<pre data-testid="prototype-state">' +
      escapeHtml(JSON.stringify(exposedState(), null, 2)) +
      "</pre>" +
      "</section>"
    );
  }

  function renderVariantA() {
    var agent = selectedAgent();
    return (
      renderVariantHeading(
        "A",
        "Watchboard",
        "Choose an agent first, then read its assignment, bearings metrics, event stream, and evidence in one working view."
      ) +
      renderMetricGrid(agent) +
      '<div class="variant-a-shell">' +
      '<aside class="panel">' +
      '<div class="panel-head"><div><h3>Agent watch</h3><p>One session at a time</p></div></div>' +
      '<div class="panel-body"><div class="agent-stack">' +
      AGENTS.map(renderAgentButton).join("") +
      "</div></div>" +
      "</aside>" +
      '<div class="variant-a-center">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Assignment</h3><p>' +
      escapeHtml(agent.sessionId) +
      "</p></div></div>" +
      '<div class="panel-body"><div class="assignment-brief"><strong>' +
      escapeHtml(agent.assignment) +
      "</strong><span>Parent " +
      escapeHtml(agent.parentId) +
      " | spawned " +
      escapeHtml(agent.spawnTime) +
      "</span></div></div>" +
      "</section>" +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Event watch</h3><p>Step through visible structural events</p></div>' +
      renderStepper(agent, false) +
      "</div>" +
      '<div class="panel-body">' +
      renderFilterRow() +
      '<div style="height:0.7rem"></div>' +
      renderEventList(agent) +
      "</div></section>" +
      "</div>" +
      '<aside class="variant-a-right">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Current evidence</h3><p>Click through for provenance</p></div></div>' +
      '<div class="panel-body">' +
      renderEventSummary(agent) +
      renderOpenEvidence() +
      "</div></section>" +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Measurement and judgment</h3><p>Separate readings, same agents</p></div></div>' +
      '<div class="panel-body">' +
      compactComparison() +
      "</div></section>" +
      renderStatePanel() +
      "</aside>" +
      "</div>"
    );
  }

  function trajectoryCoordinates(agent, event, maxElapsed) {
    var laneY = {
      spawn: 138,
      source_read: 62,
      tool_call: 112,
      retry: 194,
      replan: 222,
      artifact: 90,
      completion: 138,
    };
    return {
      x: 72 + (event.elapsedMs / Math.max(maxElapsed, 1)) * 846,
      y: laneY[event.type] || 138,
    };
  }

  function renderTrajectory(agent) {
    var visible = filteredEvents(agent);
    var current = activeEvent(agent);
    if (!visible.length) {
      return '<p class="empty-note">No trajectory nodes match the current filters.</p>';
    }
    var maxElapsed = Math.max.apply(
      null,
      agent.events.map(function (event) {
        return event.elapsedMs;
      })
    );
    var points = visible.map(function (event) {
      var point = trajectoryCoordinates(agent, event, maxElapsed);
      return point.x.toFixed(1) + "," + point.y.toFixed(1);
    });
    var nodes = visible
      .map(function (event, index) {
        var point = trajectoryCoordinates(agent, event, maxElapsed);
        var active = current && current.id === event.id;
        return (
          '<g class="trajectory-node kind-' +
          escapeHtml(event.kind) +
          (active ? " is-active" : "") +
          '">' +
          '<circle cx="' +
          point.x.toFixed(1) +
          '" cy="' +
          point.y.toFixed(1) +
          '" r="' +
          (active ? "10" : "7") +
          '" data-action="select-event" data-agent-id="' +
          escapeHtml(agent.id) +
          '" data-event-id="' +
          escapeHtml(event.id) +
          '" tabindex="0" role="button" aria-label="' +
          escapeHtml(event.title + ", T+" + formatElapsed(event.elapsedMs)) +
          '"></circle>' +
          '<text x="' +
          point.x.toFixed(1) +
          '" y="' +
          (point.y - 14).toFixed(1) +
          '" text-anchor="middle">' +
          escapeHtml(String(index + 1)) +
          "</text>" +
          "</g>"
        );
      })
      .join("");
    var ticks = [0, 0.25, 0.5, 0.75, 1]
      .map(function (ratio) {
        var x = 72 + ratio * 846;
        return (
          '<line x1="' +
          x +
          '" y1="245" x2="' +
          x +
          '" y2="251"></line>' +
          '<text x="' +
          x +
          '" y="269" text-anchor="middle">T+' +
          escapeHtml(formatElapsed(maxElapsed * ratio)) +
          "</text>"
        );
      })
      .join("");
    return (
      '<div class="trajectory-wrap">' +
      '<svg class="trajectory-chart" viewBox="0 0 960 286" role="img" aria-label="Filtered event trajectory for ' +
      escapeHtml(agent.shortName) +
      '">' +
      '<g class="trajectory-lanes">' +
      '<line x1="72" y1="62" x2="918" y2="62"></line>' +
      '<line x1="72" y1="112" x2="918" y2="112"></line>' +
      '<line x1="72" y1="138" x2="918" y2="138"></line>' +
      '<line x1="72" y1="194" x2="918" y2="194"></line>' +
      '<line x1="72" y1="222" x2="918" y2="222"></line>' +
      "</g>" +
      '<g class="trajectory-labels">' +
      '<text x="8" y="66">sources</text>' +
      '<text x="8" y="116">work</text>' +
      '<text x="8" y="142">state</text>' +
      '<text x="8" y="198">retry</text>' +
      '<text x="8" y="226">replan</text>' +
      "</g>" +
      '<polyline class="trajectory-path" points="' +
      escapeHtml(points.join(" ")) +
      '"></polyline>' +
      nodes +
      '<g class="trajectory-axis">' +
      '<line x1="72" y1="245" x2="918" y2="245"></line>' +
      ticks +
      "</g>" +
      "</svg>" +
      "</div>"
    );
  }

  function renderPlayback(agent) {
    var visible = filteredEvents(agent);
    var current = activeEvent(agent);
    var index = current
      ? visible.findIndex(function (event) {
          return event.id === current.id;
        })
      : 0;
    return (
      '<div class="playback-bar">' +
      renderStepper(agent, true) +
      '<label class="sr-only" for="trajectory-range">Event cursor</label>' +
      '<input id="trajectory-range" class="playback-range" type="range" min="0" max="' +
      escapeHtml(String(Math.max(visible.length - 1, 0))) +
      '" value="' +
      escapeHtml(String(Math.max(index, 0))) +
      '" data-action="set-event-index" data-agent-id="' +
      escapeHtml(agent.id) +
      '"' +
      (!visible.length ? " disabled" : "") +
      ">" +
      '<span class="step-label">' +
      escapeHtml(current ? current.id : "No event") +
      "</span>" +
      "</div>"
    );
  }

  function renderFlightStrip() {
    return (
      '<div class="flight-strip" aria-label="Select an agent trajectory">' +
      AGENTS.map(renderAgentButton).join("") +
      "</div>"
    );
  }

  function renderLedgerKpis(agent) {
    var framing = framingMetric(agent);
    var replans = replanMetric(agent);
    var metrics = metricsFor(agent);
    return (
      '<div class="ledger-kpis">' +
      '<button type="button" class="metric metric-button" data-kind="' +
      (framing.value === null ? "unknown" : "review") +
      '" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="framing"><span class="metric-label">Correct framing</span><span class="metric-value">' +
      escapeHtml(formatElapsed(framing.value)) +
      '</span><span class="metric-detail">Reviewer anchored</span></button>' +
      '<button type="button" class="metric metric-button" data-kind="' +
      (replans.value === null ? "unknown" : "heuristic") +
      '" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="replans"><span class="metric-label">Replans</span><span class="metric-value">' +
      escapeHtml(replans.value === null ? "?" : String(replans.value)) +
      '</span><span class="metric-detail">Before useful progress</span></button>' +
      '<button type="button" class="metric metric-button" data-kind="fact" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="sourceReads"><span class="metric-label">Source reads</span><span class="metric-value">' +
      escapeHtml(String(metrics.sourceReads)) +
      '</span><span class="metric-detail">Structural count</span></button>' +
      '<button type="button" class="metric metric-button" data-kind="fact" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="retries"><span class="metric-label">Retries</span><span class="metric-value">' +
      escapeHtml(String(metrics.retries)) +
      '</span><span class="metric-detail">Structural count</span></button>' +
      "</div>"
    );
  }

  function renderVariantB() {
    var agent = selectedAgent();
    return (
      renderVariantHeading(
        "B",
        "Flight recorder",
        "Start with the shape of the trajectory. Move the cursor along a filtered route, then inspect the current node and its evidence."
      ) +
      '<div class="variant-b-shell">' +
      renderFlightStrip() +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Trajectory map</h3><p>Node position is mechanical; meaning keeps its own evidence class</p></div></div>' +
      '<div class="panel-body">' +
      renderFilterRow() +
      "</div>" +
      renderTrajectory(agent) +
      renderPlayback(agent) +
      "</section>" +
      '<div class="ledger-grid">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Cursor evidence</h3><p>' +
      escapeHtml(agent.sessionId) +
      "</p></div></div>" +
      '<div class="panel-body">' +
      renderEventSummary(agent) +
      renderOpenEvidence() +
      '<p class="method-note">A solid node is a structural event. Amber replan nodes remain heuristic candidates. Purple metric anchors exist only where a reviewer chose an event. Empty values stay unknown.</p>' +
      "</div></section>" +
      '<aside class="ledger-side">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Readings</h3><p>Click a metric for its basis</p></div></div>' +
      '<div class="panel-body">' +
      renderLedgerKpis(agent) +
      "</div></section>" +
      renderStatePanel() +
      "</aside>" +
      "</div>" +
      "</div>"
    );
  }

  function renderComparePickers() {
    return (
      '<div class="compare-pickers" aria-label="Choose two agents to compare">' +
      AGENTS.map(function (agent) {
        var selected = state.comparisonAgentIds.indexOf(agent.id) !== -1;
        return (
          '<button type="button" class="comparison-agent' +
          (selected ? " is-selected" : "") +
          '" data-action="toggle-compare" data-agent-id="' +
          escapeHtml(agent.id) +
          '" aria-pressed="' +
          String(selected) +
          '"><strong>' +
          escapeHtml(agent.shortName) +
          "</strong><span>" +
          (selected ? "In comparison" : "Choose") +
          "</span></button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function scatterPoint(agent) {
    var framing = framingMetric(agent);
    var replans = replanMetric(agent);
    if (framing.value === null || replans.value === null) {
      return (
        '<button type="button" class="scatter-point is-unknown' +
        (agent.id === state.selectedAgentId ? " is-active" : "") +
        '" data-action="select-agent" data-agent-id="' +
        escapeHtml(agent.id) +
        '" title="' +
        escapeHtml(agent.shortName + ": metric boundary unknown") +
        '">' +
        escapeHtml(agent.shortName.slice(0, 1)) +
        "</button>"
      );
    }
    var maxFraming = 180000;
    var maxReplans = 3;
    var left = 10 + Math.min(framing.value / maxFraming, 1) * 82;
    var bottom = 9 + Math.min(replans.value / maxReplans, 1) * 78;
    return (
      '<button type="button" class="scatter-point' +
      (agent.id === state.selectedAgentId ? " is-active" : "") +
      '" style="left:' +
      left.toFixed(1) +
      "%;bottom:" +
      bottom.toFixed(1) +
      '%" data-action="select-agent" data-agent-id="' +
      escapeHtml(agent.id) +
      '" title="' +
      escapeHtml(
        agent.shortName +
          ": " +
          formatElapsed(framing.value) +
          ", " +
          String(replans.value) +
          " replans"
      ) +
      '">' +
      escapeHtml(agent.shortName.slice(0, 1)) +
      "</button>"
    );
  }

  function matrixCell(value, detail, agent, metric, kind) {
    return (
      '<td><button type="button" class="review-cell" data-action="open-metric" data-agent-id="' +
      escapeHtml(agent.id) +
      '" data-metric="' +
      escapeHtml(metric) +
      '">' +
      badge(kind) +
      "<strong>" +
      escapeHtml(value) +
      "</strong><span>" +
      escapeHtml(detail) +
      "</span></button></td>"
    );
  }

  function renderReviewMatrix(compared) {
    var mechanicalRows = [
      {
        label: "Source reads",
        render: function (agent) {
          return {
            value: String(metricsFor(agent).sourceReads),
            detail: "event count",
            metric: "sourceReads",
            kind: "fact",
          };
        },
      },
      {
        label: "Retries",
        render: function (agent) {
          return {
            value: String(metricsFor(agent).retries),
            detail: "event count",
            metric: "retries",
            kind: "fact",
          };
        },
      },
      {
        label: "Tokens",
        render: function (agent) {
          return {
            value: formatTokens(agent.tokens.total),
            detail: "input plus output",
            metric: "tokens",
            kind: "fact",
          };
        },
      },
      {
        label: "First artifact",
        render: function (agent) {
          var artifact = metricsFor(agent).firstArtifact;
          return {
            value: artifact ? "T+" + formatElapsed(artifact.elapsedMs) : "None",
            detail: artifact ? artifact.id : "no artifact event",
            metric: "artifact",
            kind: artifact ? "fact" : "unknown",
          };
        },
      },
    ];

    var reviewRows = [
      {
        label: "Assignment understood",
        render: function (agent) {
          var review = agent.review.assignmentUnderstanding;
          return {
            value: review.label,
            detail: review.reviewer
              ? review.reviewer + " | " + confidenceLabel(review.confidence)
              : "Not reviewed",
            metric: "assignment",
            kind: review.status === "reviewed" ? "review" : "unknown",
          };
        },
      },
      {
        label: "First correct framing",
        render: function (agent) {
          var metric = framingMetric(agent);
          return {
            value: formatElapsed(metric.value),
            detail: metric.anchor
              ? metric.anchor.id + " | " + confidenceLabel(metric.review.confidence)
              : "No reviewer anchor",
            metric: "framing",
            kind: metric.value === null ? "unknown" : "review",
          };
        },
      },
      {
        label: "Trajectory",
        render: function (agent) {
          var review = agent.review.trajectoryEfficiency;
          return {
            value: review.label,
            detail: review.reviewer
              ? review.reviewer + " | " + confidenceLabel(review.confidence)
              : "Not reviewed",
            metric: "trajectory",
            kind: review.status === "reviewed" ? "review" : "unknown",
          };
        },
      },
      {
        label: "Replans before progress",
        render: function (agent) {
          var metric = replanMetric(agent);
          return {
            value: metric.value === null ? "Not reviewed" : String(metric.value),
            detail: metric.boundary
              ? "candidates before " + metric.boundary.id
              : "progress boundary missing",
            metric: "replans",
            kind: metric.value === null ? "unknown" : "heuristic",
          };
        },
      },
    ];

    function table(rows, label) {
      return (
        '<table class="comparison-table">' +
        '<thead><tr><th>' +
        escapeHtml(label) +
        "</th>" +
        compared
          .map(function (agent) {
            return "<th>" + escapeHtml(agent.shortName) + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>" +
        rows
          .map(function (row) {
            return (
              "<tr><th>" +
              escapeHtml(row.label) +
              "</th>" +
              compared
                .map(function (agent) {
                  var cell = row.render(agent);
                  return matrixCell(
                    cell.value,
                    cell.detail,
                    agent,
                    cell.metric,
                    cell.kind
                  );
                })
                .join("") +
              "</tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      );
    }

    return (
      table(mechanicalRows, "Deterministic measurements") +
      '<div style="height:0.9rem"></div>' +
      table(reviewRows, "Semantic review and candidates")
    );
  }

  function renderCompareTrace(agent) {
    var current = activeEvent(agent);
    return (
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>' +
      escapeHtml(agent.shortName) +
      ' trace</h3><p>' +
      escapeHtml(current ? current.id : "No visible event") +
      "</p></div>" +
      renderStepper(agent, true) +
      "</div>" +
      '<div class="panel-body">' +
      renderEventList(agent, 7) +
      "</div></section>"
    );
  }

  function renderVariantC() {
    var compared = state.comparisonAgentIds.map(findAgent).filter(Boolean);
    return (
      renderVariantHeading(
        "C",
        "Review room",
        "Compare two agents before reading either trace. Mechanical speed can now disagree visibly with reviewer judgments."
      ) +
      '<div class="variant-c-shell">' +
      renderComparePickers() +
      '<div class="review-grid">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Bearing plot</h3><p>Only reviewer-bounded metrics receive coordinates</p></div></div>' +
      '<div class="scatter">' +
      compared.map(scatterPoint).join("") +
      "</div>" +
      '<p class="method-note">Right is later framing. Up is more candidate replans before reviewer-marked progress. The lower-right hollow point has no complete review boundary, so it is not plotted as a score.</p>' +
      "</section>" +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Evidence matrix</h3><p>Measurement and interpretation remain separate</p></div></div>' +
      '<div class="panel-body">' +
      renderReviewMatrix(compared) +
      "</div></section>" +
      "</div>" +
      '<div class="review-lower">' +
      "<div>" +
      compared.map(renderCompareTrace).join('<div style="height:0.75rem"></div>') +
      "</div>" +
      "<aside>" +
      '<section class="panel">' +
      '<div class="panel-head"><div><h3>Selected evidence</h3><p>Pick a cell or trace event</p></div></div>' +
      '<div class="panel-body">' +
      renderEventSummary(selectedAgent()) +
      renderOpenEvidence() +
      "</div></section>" +
      '<div style="height:0.75rem"></div>' +
      renderStatePanel() +
      "</aside>" +
      "</div>" +
      "</div>"
    );
  }

  function normalizeState() {
    if (!findAgent(state.selectedAgentId)) {
      state.selectedAgentId = AGENTS[0].id;
    }
    AGENTS.forEach(function (agent) {
      var visible = filteredEvents(agent);
      var cursorIsVisible = visible.some(function (event) {
        return event.id === state.eventCursorByAgent[agent.id];
      });
      if (!cursorIsVisible) {
        state.eventCursorByAgent[agent.id] = visible.length ? visible[0].id : null;
      }
    });
    state.comparisonAgentIds = state.comparisonAgentIds.filter(function (agentId) {
      return Boolean(findAgent(agentId));
    });
    while (state.comparisonAgentIds.length < 2) {
      var next = AGENTS.find(function (agent) {
        return state.comparisonAgentIds.indexOf(agent.id) === -1;
      });
      if (!next) {
        break;
      }
      state.comparisonAgentIds.push(next.id);
    }
    if (state.comparisonAgentIds.length > 2) {
      state.comparisonAgentIds = state.comparisonAgentIds.slice(-2);
    }
    if (
      state.variant === "C" &&
      state.comparisonAgentIds.indexOf(state.selectedAgentId) === -1
    ) {
      state.selectedAgentId = state.comparisonAgentIds[0];
    }
  }

  function updateVariantUrl() {
    var url = new URL(window.location.href);
    url.searchParams.set("variant", state.variant);
    window.history.replaceState({}, "", url);
  }

  function render() {
    normalizeState();
    if (state.variant === "B") {
      app.innerHTML = renderVariantB();
    } else if (state.variant === "C") {
      app.innerHTML = renderVariantC();
    } else {
      app.innerHTML = renderVariantA();
    }
    var variant = VARIANTS.find(function (candidate) {
      return candidate.key === state.variant;
    });
    variantLabel.textContent = variant.key + " | " + variant.name;
    document.title =
      "Bearings " + variant.key + " | " + variant.name + " | local prototype";
  }

  function commit(action, mutation) {
    mutation();
    state.lastAction = action;
    state.actionCount += 1;
    normalizeState();
    render();
  }

  function setVariant(directionOrKey) {
    var currentIndex = VARIANTS.findIndex(function (variant) {
      return variant.key === state.variant;
    });
    var nextIndex;
    if (directionOrKey === "previous") {
      nextIndex = (currentIndex - 1 + VARIANTS.length) % VARIANTS.length;
    } else if (directionOrKey === "next") {
      nextIndex = (currentIndex + 1) % VARIANTS.length;
    } else {
      nextIndex = VARIANTS.findIndex(function (variant) {
        return variant.key === directionOrKey;
      });
      if (nextIndex < 0) {
        return;
      }
    }
    commit("switched variant to " + VARIANTS[nextIndex].key, function () {
      state.variant = VARIANTS[nextIndex].key;
    });
    updateVariantUrl();
  }

  function stepEvent(agentId, direction) {
    var agent = findAgent(agentId);
    if (!agent) {
      return;
    }
    var visible = filteredEvents(agent);
    var current = activeEvent(agent);
    var index = visible.findIndex(function (event) {
      return current && event.id === current.id;
    });
    var nextIndex = Math.max(0, Math.min(visible.length - 1, index + direction));
    if (!visible[nextIndex]) {
      return;
    }
    commit(
      "stepped " + agent.shortName + " to " + visible[nextIndex].id,
      function () {
        state.selectedAgentId = agent.id;
        state.eventCursorByAgent[agent.id] = visible[nextIndex].id;
        state.openEvidenceId = null;
      }
    );
  }

  function handleAction(control) {
    var action = control.getAttribute("data-action");
    if (action === "select-agent") {
      var agentId = control.getAttribute("data-agent-id");
      commit("selected agent " + agentId, function () {
        state.selectedAgentId = agentId;
        state.openEvidenceId = null;
      });
    } else if (action === "select-event") {
      var eventAgentId = control.getAttribute("data-agent-id");
      var eventId = control.getAttribute("data-event-id");
      commit("selected event " + eventId, function () {
        state.selectedAgentId = eventAgentId;
        state.eventCursorByAgent[eventAgentId] = eventId;
        state.openEvidenceId = null;
      });
    } else if (action === "step-event") {
      stepEvent(
        control.getAttribute("data-agent-id"),
        Number(control.getAttribute("data-direction"))
      );
    } else if (action === "toggle-filter") {
      var eventType = control.getAttribute("data-event-type");
      commit("toggled event filter " + eventType, function () {
        var index = state.visibleEventTypes.indexOf(eventType);
        if (index === -1) {
          state.visibleEventTypes.push(eventType);
          state.visibleEventTypes.sort(function (left, right) {
            var leftIndex = EVENT_TYPES.findIndex(function (item) {
              return item.key === left;
            });
            var rightIndex = EVENT_TYPES.findIndex(function (item) {
              return item.key === right;
            });
            return leftIndex - rightIndex;
          });
        } else {
          state.visibleEventTypes.splice(index, 1);
        }
        state.openEvidenceId = null;
      });
    } else if (action === "open-evidence") {
      var evidenceId = control.getAttribute("data-evidence-id");
      commit("opened evidence " + evidenceId, function () {
        state.openEvidenceId = evidenceId;
      });
    } else if (action === "open-metric") {
      var metricAgentId = control.getAttribute("data-agent-id");
      var metric = control.getAttribute("data-metric");
      commit("opened " + metric + " basis for " + metricAgentId, function () {
        state.selectedAgentId = metricAgentId;
        state.openEvidenceId = "metric:" + metricAgentId + ":" + metric;
      });
    } else if (action === "close-evidence") {
      commit("closed evidence", function () {
        state.openEvidenceId = null;
      });
    } else if (action === "toggle-compare") {
      var compareId = control.getAttribute("data-agent-id");
      commit("changed comparison agent to " + compareId, function () {
        if (state.comparisonAgentIds.indexOf(compareId) !== -1) {
          state.selectedAgentId = compareId;
        } else {
          state.comparisonAgentIds = state.comparisonAgentIds
            .concat(compareId)
            .slice(-2);
          state.selectedAgentId = compareId;
        }
        state.openEvidenceId = null;
      });
    } else if (action === "reset-state") {
      commit("reset prototype state", function () {
        state.selectedAgentId = AGENTS[0].id;
        state.eventCursorByAgent = initialCursors();
        state.visibleEventTypes = EVENT_TYPES.map(function (type) {
          return type.key;
        });
        state.openEvidenceId = null;
        state.comparisonAgentIds = [AGENTS[0].id, AGENTS[1].id];
      });
    }
  }

  app.addEventListener("click", function (event) {
    var control = event.target.closest("[data-action]");
    if (control) {
      handleAction(control);
    }
  });

  app.addEventListener("change", function (event) {
    var control = event.target.closest('[data-action="set-event-index"]');
    if (!control) {
      return;
    }
    var agent = findAgent(control.getAttribute("data-agent-id"));
    var visible = agent ? filteredEvents(agent) : [];
    var selected = visible[Number(control.value)];
    if (!agent || !selected) {
      return;
    }
    commit("moved trajectory cursor to " + selected.id, function () {
      state.selectedAgentId = agent.id;
      state.eventCursorByAgent[agent.id] = selected.id;
      state.openEvidenceId = null;
    });
  });

  switcher.addEventListener("click", function (event) {
    var control = event.target.closest("[data-switch-variant]");
    if (control) {
      setVariant(control.getAttribute("data-switch-variant"));
    }
  });

  document.addEventListener("keydown", function (event) {
    var target = event.target;
    var tagName = target && target.tagName ? target.tagName : "";
    var isEditing =
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      (target && target.isContentEditable);

    if (
      !isEditing &&
      (event.key === "Enter" || event.key === " ") &&
      target &&
      target.matches('[data-action="select-event"]')
    ) {
      event.preventDefault();
      handleAction(target);
      return;
    }

    if (event.key === "Escape" && state.openEvidenceId) {
      commit("closed evidence with Escape", function () {
        state.openEvidenceId = null;
      });
      return;
    }

    if (isEditing) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setVariant("previous");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setVariant("next");
    }
  });

  window.addEventListener("popstate", function () {
    var nextVariant = requestedVariant();
    if (nextVariant !== state.variant) {
      commit("restored variant from URL", function () {
        state.variant = nextVariant;
      });
    }
  });

  render();
})();
