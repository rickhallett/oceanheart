import { v, ConvexError } from "convex/values";
import * as catalog from "./catalog";

// Practice details live on the tenants table (with the existing name and time
// zone) plus one default weekly availability record. Availability is the
// owner's declared default for future public scheduling: each of the seven
// weekdays is either closed (null) or one open/close interval written in the
// practice time zone. It is not an enforced bookable slot and only that single
// source is stored.
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type DayInterval = { open: string; close: string } | null;
export type WeeklyAvailability = Record<Weekday, DayInterval>;

export const dayInterval = v.union(
  v.null(),
  v.object({ open: v.string(), close: v.string() }),
);
export const availabilityObject = v.object(
  Object.fromEntries(
    WEEKDAYS.map((day) => [day, dayInterval]),
  ) as Record<Weekday, typeof dayInterval>,
);

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function minutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}
export function normalizeAvailability(
  value: Record<Weekday, DayInterval | undefined>,
): WeeklyAvailability {
  const result = {} as WeeklyAvailability;
  for (const day of WEEKDAYS) {
    const entry = value[day];
    if (!entry) {
      result[day] = null;
      continue;
    }
    // Opening/closing times are exact HH:MM strings in the practice time
    // zone; any other spelling is a validation error, not a normalization.
    const open = entry.open,
      close = entry.close;
    if (
      !TIME.test(open) ||
      !TIME.test(close) ||
      minutes(close) <= minutes(open)
    )
      throw new ConvexError("INVALID_AVAILABILITY");
    result[day] = { open, close };
  }
  return result;
}
export const closedWeek = (): WeeklyAvailability => {
  const result = {} as WeeklyAvailability;
  for (const day of WEEKDAYS) result[day] = null;
  return result;
};
export function settingsFields(args: {
  name: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  availability: Record<Weekday, DayInterval>;
}) {
  const result = {
    name: catalog.name(args.name),
    tagline: text(args.tagline, 200, "INVALID_TAGLINE"),
    contactEmail: email(args.contactEmail),
    contactPhone: phone(args.contactPhone),
    address: text(args.address, 500, "INVALID_ADDRESS"),
    availability: normalizeAvailability(args.availability),
  };
  return result;
}
function text(value: string | undefined, max: number, code: string) {
  const normalized = catalog.optional(value, max, code);
  if (normalized && /[\p{Cc}\p{Zl}\p{Zp}]/u.test(normalized))
    throw new ConvexError(code);
  return normalized;
}
function email(value: string | undefined) {
  const normalized = catalog.optional(value, 254, "INVALID_EMAIL");
  if (
    normalized &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
      /[\p{Cc}\p{Zl}\p{Zp}]/u.test(normalized))
  )
    throw new ConvexError("INVALID_EMAIL");
  return normalized;
}
function phone(value: string | undefined) {
  const normalized = catalog.optional(value, 40, "INVALID_PHONE");
  if (normalized && /[\p{Cc}\p{Zl}\p{Zp}]/u.test(normalized))
    throw new ConvexError("INVALID_PHONE");
  return normalized;
}
export function currentSettings(tenant: {
  name: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  availability?: Record<Weekday, DayInterval>;
}) {
  return {
    name: tenant.name,
    tagline: tenant.tagline ?? undefined,
    contactEmail: tenant.contactEmail ?? undefined,
    contactPhone: tenant.contactPhone ?? undefined,
    address: tenant.address ?? undefined,
    availability: tenant.availability ?? closedWeek(),
  };
}
// Convex may preserve a storage-insertion key order that differs from the
// WEEKDAY declaration order, so a retried identical payload must compare
// structurally rather than by raw serialization.
export const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, val) =>
    !val || typeof val !== "object" || Array.isArray(val)
      ? val
      : Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]])),
  );