import { expect, it } from "vitest";
import { practiceDayAt } from "../../backend/convex/lib/practiceDay";

it("derives authoritative London day bounds across both DST changes", () => {
  const spring = practiceDayAt(
    "Europe/London",
    Date.parse("2027-03-28T12:00:00Z"),
  );
  expect(spring).toMatchObject({
    day: "2027-03-28",
    timeZone: "Europe/London",
    from: Date.parse("2027-03-28T00:00:00Z"),
    to: Date.parse("2027-03-28T23:00:00Z"),
  });
  expect(spring!.to - spring!.from).toBe(23 * 60 * 60 * 1000);

  const autumn = practiceDayAt(
    "Europe/London",
    Date.parse("2027-10-31T12:00:00Z"),
  );
  expect(autumn).toMatchObject({
    day: "2027-10-31",
    timeZone: "Europe/London",
    from: Date.parse("2027-10-30T23:00:00Z"),
    to: Date.parse("2027-11-01T00:00:00Z"),
  });
  expect(autumn!.to - autumn!.from).toBe(25 * 60 * 60 * 1000);
});

it("fails closed for an invalid time zone", () => {
  expect(practiceDayAt("Not/AZone", Date.now())).toBeNull();
});
