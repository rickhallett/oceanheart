import { Temporal } from "@js-temporal/polyfill";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { WEEKDAYS } from "./settings";

type Segment = { from: number; to: number };

function boundaryInstants(
  date: Temporal.PlainDate,
  time: string,
  timeZone: string,
) {
  const [hour, minute] = time.split(":").map(Number);
  const requested = date.toPlainDateTime({ hour, minute });
  const instants: number[] = [];
  for (const disambiguation of ["earlier", "later"] as const) {
    const boundary = Temporal.ZonedDateTime.from(
      {
        timeZone,
        year: date.year,
        month: date.month,
        day: date.day,
        hour,
        minute,
      },
      { disambiguation },
    );
    // A nonexistent wall time is shifted by Temporal. It is deliberately not
    // accepted as a boundary; the whole local day fails closed below.
    if (
      boundary.toPlainDateTime().equals(requested) &&
      !instants.includes(boundary.epochMilliseconds)
    )
      instants.push(boundary.epochMilliseconds);
  }
  return instants;
}

function localMilliseconds(value: Temporal.ZonedDateTime) {
  return (
    ((value.hour * 60 + value.minute) * 60 + value.second) * 1_000 +
    value.millisecond +
    value.microsecond / 1_000 +
    value.nanosecond / 1_000_000
  );
}

function allowedSegments(
  date: Temporal.PlainDate,
  open: string,
  close: string,
  timeZone: string,
): Segment[] {
  const dayStart = date.toZonedDateTime({
    timeZone,
    plainTime: "00:00",
  }).epochMilliseconds;
  const dayEnd = date.add({ days: 1 }).toZonedDateTime({
    timeZone,
    plainTime: "00:00",
  }).epochMilliseconds;
  const opening = boundaryInstants(date, open, timeZone);
  const closing = boundaryInstants(date, close, timeZone);
  if (!opening.length || !closing.length || dayEnd <= dayStart) return [];

  const cuts = [dayStart, dayEnd, ...opening, ...closing];
  let cursor = Temporal.Instant.fromEpochMilliseconds(
    dayStart,
  ).toZonedDateTimeISO(timeZone);
  while (true) {
    const transition = cursor.getTimeZoneTransition("next");
    if (!transition || transition.epochMilliseconds >= dayEnd) break;
    if (transition.epochMilliseconds > dayStart)
      cuts.push(transition.epochMilliseconds);
    cursor = transition;
  }

  const [openHour, openMinute] = open.split(":").map(Number);
  const [closeHour, closeMinute] = close.split(":").map(Number);
  const openAt = (openHour * 60 + openMinute) * 60_000;
  const closeAt = (closeHour * 60 + closeMinute) * 60_000;
  const sorted = [...new Set(cuts)].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[index + 1];
    if (from === to) continue;
    const local = Temporal.Instant.fromEpochMilliseconds(
      from,
    ).toZonedDateTimeISO(timeZone);
    if (
      local.toPlainDate().equals(date) &&
      localMilliseconds(local) >= openAt &&
      localMilliseconds(local) < closeAt
    ) {
      const previous = segments.at(-1);
      if (previous?.to === from) previous.to = to;
      else segments.push({ from, to });
    }
  }
  return segments;
}

/**
 * Enforce the tenant's opt-in weekly hours against the complete elapsed
 * booking interval. Repeated wall-clock ranges become separate allowed
 * segments when the fall-back transition leaves the declared interval;
 * nonexistent opening or closing times make that local day unavailable.
 */
export function requireBookingHours(
  tenant: Pick<
    Doc<"tenants">,
    "enforceBookingHours" | "timeZone" | "availability"
  >,
  startsAt: number,
  endsAt: number,
) {
  if (!tenant.enforceBookingHours) return;
  if (!tenant.timeZone) throw new ConvexError("TIME_ZONE_REQUIRED");
  try {
    const start = Temporal.Instant.fromEpochMilliseconds(
      startsAt,
    ).toZonedDateTimeISO(tenant.timeZone);
    const interval = tenant.availability?.[WEEKDAYS[start.dayOfWeek - 1]];
    if (
      !interval ||
      !allowedSegments(
        start.toPlainDate(),
        interval.open,
        interval.close,
        tenant.timeZone,
      ).some(({ from, to }) => startsAt >= from && endsAt <= to)
    )
      throw new ConvexError("OUTSIDE_PRACTICE_HOURS");
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw new ConvexError("INVALID_TIME_ZONE");
  }
}
