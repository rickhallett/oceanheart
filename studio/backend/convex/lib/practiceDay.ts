export type PracticeDay = {
  day: string;
  timeZone: string;
  from: number;
  to: number;
  refreshAfterMs: number;
};

function parts(formatter: Intl.DateTimeFormat, instant: number) {
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter(({ type }) => type === "year" || type === "month" || type === "day")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1))
    .toISOString()
    .slice(0, 10);
}

function firstInstantOnOrAfter(
  day: string,
  formatter: Intl.DateTimeFormat,
) {
  const [year, month, date] = day.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, date);
  let low = guess - 36 * 60 * 60 * 1000;
  let high = guess + 36 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (parts(formatter, middle) >= day) high = middle;
    else low = middle + 1;
  }
  return low;
}

export function practiceDayAt(
  timeZone: string,
  now = Date.now(),
): PracticeDay | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA-u-ca-iso8601-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const day = parts(formatter, now);
    const from = firstInstantOnOrAfter(day, formatter);
    const to = firstInstantOnOrAfter(nextDate(day), formatter);
    if (parts(formatter, from) !== day || to <= from) return null;
    return {
      day,
      timeZone,
      from,
      to,
      refreshAfterMs: Math.max(1, to - now),
    };
  } catch {
    return null;
  }
}
