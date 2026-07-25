var TherapyOpsCore = (function () {
  "use strict";

  var AUDIT_DETAIL_KEYS = {
    artifactType: true,
    consentVersion: true,
    copyVersion: true,
    fromState: true,
    processorId: true,
    purpose: true,
    reasonCode: true,
    sessionId: true,
    toState: true,
  };

  var FORBIDDEN_AUDIT_KEY_PATTERN =
    /(name|email|phone|address|birth|clinical|transcript|intake|riskNarrative)/i;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso(now) {
    var value = now || new Date();
    return value instanceof Date ? value.toISOString() : String(value);
  }

  function hasFact(facts, key) {
    var value = facts[key];
    if (value === false || value === null || value === undefined || value === "") {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  function findTransition(workflow, fromState, toState) {
    for (var index = 0; index < workflow.transitions.length; index += 1) {
      var transition = workflow.transitions[index];
      if (transition.from === fromState && transition.to === toState) {
        return transition;
      }
    }
    return null;
  }

  function missingRequirements(requirements, facts) {
    return requirements.filter(function (requirement) {
      return !hasFact(facts, requirement);
    });
  }

  function assertAuditSafe(details) {
    var safeDetails = details || {};
    Object.keys(safeDetails).forEach(function (key) {
      if (!AUDIT_DETAIL_KEYS[key] || FORBIDDEN_AUDIT_KEY_PATTERN.test(key)) {
        throw new Error("UNSAFE_AUDIT_DETAIL:" + key);
      }
      var value = safeDetails[key];
      if (value !== null && value !== undefined && typeof value !== "string") {
        throw new Error("INVALID_AUDIT_DETAIL:" + key);
      }
      if (typeof value === "string" && (value.indexOf("@") >= 0 || value.length > 120)) {
        throw new Error("UNSAFE_AUDIT_VALUE:" + key);
      }
    });
    return clone(safeDetails);
  }

  function auditEvent(clientId, action, result, actorType, details, now) {
    return {
      timestamp: nowIso(now),
      clientId: clientId,
      action: action,
      result: result,
      actorType: actorType || "practitioner",
      details: assertAuditSafe(details),
    };
  }

  function createClientRecord(clientId, invitationCode, copyVersion, now) {
    if (!/^OH-[A-Z0-9]{8}$/.test(clientId)) {
      throw new Error("INVALID_CLIENT_ID");
    }
    if (!/^[A-Z0-9]{12}$/.test(invitationCode)) {
      throw new Error("INVALID_INVITATION_CODE");
    }
    return {
      clientId: clientId,
      invitationCode: invitationCode,
      state: "ENQUIRY",
      copyVersion: copyVersion,
      facts: {},
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
    };
  }

  function transition(workflow, record, toState, newFacts, actorType, now) {
    var transitionDefinition = findTransition(
      workflow,
      record.state,
      toState,
    );
    if (!transitionDefinition) {
      throw new Error(
        "INVALID_TRANSITION:" + record.state + ":" + toState,
      );
    }

    var facts = Object.assign({}, record.facts, clone(newFacts || {}));
    var missing = missingRequirements(transitionDefinition.requires, facts);
    if (missing.length > 0) {
      throw new Error("GATE_BLOCKED:" + missing.join(","));
    }

    var nextRecord = clone(record);
    nextRecord.state = toState;
    nextRecord.facts = facts;
    nextRecord.updatedAt = nowIso(now);

    return {
      record: nextRecord,
      audit: auditEvent(
        record.clientId,
        "STATE_TRANSITION",
        "allowed",
        actorType,
        {
          copyVersion: record.copyVersion,
          fromState: record.state,
          toState: toState,
        },
        now,
      ),
    };
  }

  function findActionRule(workflow, action) {
    for (var index = 0; index < workflow.failClosedRules.length; index += 1) {
      var rule = workflow.failClosedRules[index];
      if (rule.action === action) {
        return rule;
      }
    }
    return null;
  }

  function authorizeAction(workflow, record, action, context, actorType, now) {
    var rule = findActionRule(workflow, action);
    if (!rule) {
      throw new Error("UNKNOWN_ACTION:" + action);
    }
    var merged = Object.assign({}, record.facts, clone(context || {}));
    var missing = missingRequirements(rule.requires, merged);
    if (missing.length > 0) {
      return {
        allowed: false,
        missing: missing,
        audit: auditEvent(
          record.clientId,
          action,
          "blocked",
          actorType,
          {
            reasonCode: "missing-required-gates",
          },
          now,
        ),
      };
    }
    return {
      allowed: true,
      missing: [],
      audit: auditEvent(
        record.clientId,
        action,
        "allowed",
        actorType,
        compactActionDetails(action, context),
        now,
      ),
    };
  }

  function compactActionDetails(action, context) {
    var details = {};
    var source = context || {};
    if (source.consentVersion) {
      details.consentVersion = String(source.consentVersion);
    }
    if (source.sessionId) {
      details.sessionId = String(source.sessionId);
    }
    if (source.approvedPurpose) {
      details.purpose = String(source.approvedPurpose);
    }
    if (source.approvedProcessor) {
      details.processorId = String(source.approvedProcessor);
    }
    if (source.artifactType) {
      details.artifactType = String(source.artifactType);
    }
    if (action === "DELETE_RECORD") {
      details.reasonCode = "retention-review-approved";
    }
    return details;
  }

  function flattenLeaves(value, result) {
    var target = result || {};
    Object.keys(value || {}).forEach(function (key) {
      var child = value[key];
      if (Array.isArray(child)) {
        target[key] = child.join(", ");
      } else if (child && typeof child === "object") {
        flattenLeaves(child, target);
      } else {
        target[key] = child;
      }
    });
    return target;
  }

  function renderTemplate(template, values, strict) {
    var flattened = flattenLeaves(values || {});
    var rendered = template.replace(
      /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g,
      function (match, key) {
        if (
          flattened[key] === undefined ||
          flattened[key] === null ||
          flattened[key] === ""
        ) {
          return match;
        }
        return String(flattened[key]);
      },
    );
    if (strict && /\{\{[A-Za-z][A-Za-z0-9]*\}\}/.test(rendered)) {
      throw new Error("UNRESOLVED_TEMPLATE_PLACEHOLDER");
    }
    return rendered;
  }

  function isPlaceholderValue(value) {
    return typeof value === "string" && /^\[[A-Z0-9_]+\]$/.test(value);
  }

  function findPlaceholderValues(value, path, result) {
    var currentPath = path || "";
    var matches = result || [];
    if (Array.isArray(value)) {
      value.forEach(function (child, index) {
        findPlaceholderValues(
          child,
          currentPath + "[" + index + "]",
          matches,
        );
      });
      return matches;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach(function (key) {
        findPlaceholderValues(
          value[key],
          currentPath ? currentPath + "." + key : key,
          matches,
        );
      });
      return matches;
    }
    if (isPlaceholderValue(value)) {
      matches.push(currentPath);
    }
    return matches;
  }

  return {
    auditEvent: auditEvent,
    authorizeAction: authorizeAction,
    createClientRecord: createClientRecord,
    findPlaceholderValues: findPlaceholderValues,
    renderTemplate: renderTemplate,
    transition: transition,
  };
})();
