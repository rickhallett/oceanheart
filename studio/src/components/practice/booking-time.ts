import { Temporal } from "@js-temporal/polyfill";
export type TimeChoice = { startsAt: number; offset: string };
export function bookingTimeChoices(
  local: string,
  timeZone: string,
): TimeChoice[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Enter a complete date and time.");
  let value: Temporal.PlainDateTime;
  try {
    value = Temporal.PlainDateTime.from(local, { overflow: "reject" });
  } catch {
    throw new Error("Enter a valid date and time.");
  }
  let earlier: Temporal.ZonedDateTime, later: Temporal.ZonedDateTime;
  try {
    earlier = value.toZonedDateTime(timeZone, { disambiguation: "earlier" });
    later = value.toZonedDateTime(timeZone, { disambiguation: "later" });
  } catch {
    throw new Error("Choose a valid IANA time zone.");
  }
  if (
    !earlier.toPlainDateTime().equals(value) ||
    !later.toPlainDateTime().equals(value)
  )
    throw new Error(
      "This local time does not exist because the clocks move forward. Choose another time.",
    );
  if (earlier.epochMilliseconds < 0)
    throw new Error("Choose a date after 1 January 1970.");
  const first = { startsAt: earlier.epochMilliseconds, offset: earlier.offset };
  return earlier.epochMilliseconds === later.epochMilliseconds
    ? [first]
    : [first, { startsAt: later.epochMilliseconds, offset: later.offset }];
}
export function resolveBookingTime(
  local: string,
  timeZone: string,
  fold: string,
): number {
  const choices = bookingTimeChoices(local, timeZone);
  if (choices.length === 1) return choices[0].startsAt;
  if (fold !== "earlier" && fold !== "later")
    throw new Error(
      "This local time occurs twice. Choose the earlier or later occurrence.",
    );
  return choices[fold === "earlier" ? 0 : 1].startsAt;
}
export function bookingDay(day: string, timeZone: string) {
  const date = Temporal.PlainDate.from(day),
    start = date.toZonedDateTime(timeZone),
    end = date.add({ days: 1 }).toZonedDateTime(timeZone);
  if (!start.toPlainDate().equals(date))
    throw new Error("This date does not exist in the selected time zone.");
  if (start.epochMilliseconds < 0)
    throw new Error("Choose a date after 1 January 1970.");
  return { from: start.epochMilliseconds, to: end.epochMilliseconds };
}
export function todayIn(timeZone: string) {
  return Temporal.Now.plainDateISO(timeZone).toString();
}
export function localBookingTime(startsAt: number, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(startsAt)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function displayBookingTime(startsAt: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(startsAt);
}
